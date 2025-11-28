import React, { useState, useEffect } from 'react'
import { useDatabase } from '../contexts/DatabaseContext'
import { Line, Bar, Radar } from 'react-chartjs-2'
import { TrendingUp, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react'

export default function Analytics() {
  const { query } = useDatabase()
  const [analyticsData, setAnalyticsData] = useState({
    revenueComparison: null,
    profitabilityTrends: null,
    inconsistencyAnalysis: null,
    financialRatios: null
  })
  const [selectedCompanies, setSelectedCompanies] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    if (selectedCompanies.length > 0) {
      loadAnalyticsData()
    }
  }, [selectedCompanies])

  const loadCompanies = async () => {
    try {
      const result = await query(`
        SELECT c.id, c.name, COUNT(fs.id) as statement_count
        FROM companies c
        LEFT JOIN financial_statements fs ON c.id = fs.company_id
        GROUP BY c.id, c.name
        HAVING COUNT(fs.id) > 0
        ORDER BY c.name
      `)
      
      const companiesList = result.data || []
      setCompanies(companiesList)
      
      // Auto-select first few companies
      if (companiesList.length > 0) {
        setSelectedCompanies(companiesList.slice(0, Math.min(3, companiesList.length)).map(c => c.id))
      }
    } catch (error) {
      console.error('Error loading companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAnalyticsData = async () => {
    try {
      // Revenue comparison
      const revenueResult = await query(`
        SELECT 
          c.name as company,
          fm.metric_value as revenue,
          fs.year,
          fs.quarter
        FROM financial_metrics fm
        JOIN financial_statements fs ON fm.statement_id = fs.id
        JOIN companies c ON fs.company_id = c.id
        WHERE fm.metric_name = 'total_revenue' 
        AND c.id = ANY($1)
        ORDER BY fs.year, fs.quarter NULLS LAST
      `, [selectedCompanies])

      // Profitability trends
      const profitResult = await query(`
        SELECT 
          c.name as company,
          fm.metric_value as profit,
          fs.year,
          fs.quarter,
          fm.metric_name
        FROM financial_metrics fm
        JOIN financial_statements fs ON fm.statement_id = fs.id
        JOIN companies c ON fs.company_id = c.id
        WHERE fm.metric_name IN ('net_income', 'gross_profit', 'operating_profit')
        AND c.id = ANY($1)
        ORDER BY fs.year, fs.quarter NULLS LAST
      `, [selectedCompanies])

      // Inconsistency analysis
      const inconsistencyResult = await query(`
        SELECT 
          c.name as company,
          i.severity,
          COUNT(*) as count
        FROM inconsistencies i
        JOIN financial_statements fs ON i.statement_id = fs.id
        JOIN companies c ON fs.company_id = c.id
        WHERE c.id = ANY($1)
        GROUP BY c.name, i.severity
        ORDER BY c.name, i.severity
      `, [selectedCompanies])

      // Financial ratios
      const ratiosResult = await query(`
        SELECT 
          c.name as company,
          fm.metric_name,
          fm.metric_value,
          fs.year
        FROM financial_metrics fm
        JOIN financial_statements fs ON fm.statement_id = fs.id
        JOIN companies c ON fs.company_id = c.id
        WHERE fm.metric_name IN ('current_ratio', 'debt_to_equity', 'return_on_equity', 'return_on_assets')
        AND c.id = ANY($1)
        ORDER BY c.name, fs.year DESC
      `, [selectedCompanies])

      setAnalyticsData({
        revenueComparison: processRevenueData(revenueResult.data || []),
        profitabilityTrends: processProfitabilityData(profitResult.data || []),
        inconsistencyAnalysis: processInconsistencyData(inconsistencyResult.data || []),
        financialRatios: processRatiosData(ratiosResult.data || [])
      })
    } catch (error) {
      console.error('Error loading analytics data:', error)
    }
  }

  const processRevenueData = (data) => {
    const companies = [...new Set(data.map(d => d.company))]
    const periods = [...new Set(data.map(d => `${d.year}${d.quarter ? `-Q${d.quarter}` : ''}`))]
      .sort()

    return {
      labels: periods,
      datasets: companies.map((company, index) => ({
        label: company,
        data: periods.map(period => {
          const [year, quarter] = period.split('-Q')
          const item = data.find(d => 
            d.company === company && 
            d.year.toString() === year && 
            (quarter ? d.quarter?.toString() === quarter : !d.quarter)
          )
          return item ? parseFloat(item.revenue) / 1000000 : null
        }),
        borderColor: `hsl(${index * 137.5 % 360}, 70%, 50%)`,
        backgroundColor: `hsla(${index * 137.5 % 360}, 70%, 50%, 0.1)`,
        tension: 0.1
      }))
    }
  }

  const processProfitabilityData = (data) => {
    const companies = [...new Set(data.map(d => d.company))]
    const metrics = ['net_income', 'gross_profit', 'operating_profit']

    return {
      labels: companies,
      datasets: metrics.map((metric, index) => ({
        label: metric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        data: companies.map(company => {
          const items = data.filter(d => d.company === company && d.metric_name === metric)
          const latest = items.sort((a, b) => b.year - a.year)[0]
          return latest ? parseFloat(latest.profit) / 1000000 : 0
        }),
        backgroundColor: `hsla(${index * 120}, 70%, 50%, 0.8)`
      }))
    }
  }

  const processInconsistencyData = (data) => {
    const companies = [...new Set(data.map(d => d.company))]
    const severities = ['low', 'medium', 'high']

    return {
      labels: companies,
      datasets: severities.map((severity, index) => ({
        label: severity.charAt(0).toUpperCase() + severity.slice(1),
        data: companies.map(company => {
          const item = data.find(d => d.company === company && d.severity === severity)
          return item ? parseInt(item.count) : 0
        }),
        backgroundColor: severity === 'high' ? 'rgba(239, 68, 68, 0.8)' :
                        severity === 'medium' ? 'rgba(245, 158, 11, 0.8)' :
                        'rgba(34, 197, 94, 0.8)'
      }))
    }
  }

  const processRatiosData = (data) => {
    const companies = [...new Set(data.map(d => d.company))]
    const ratios = ['current_ratio', 'debt_to_equity', 'return_on_equity', 'return_on_assets']

    return {
      labels: ratios.map(r => r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())),
      datasets: companies.map((company, index) => ({
        label: company,
        data: ratios.map(ratio => {
          const items = data.filter(d => d.company === company && d.metric_name === ratio)
          const latest = items.sort((a, b) => b.year - a.year)[0]
          return latest ? parseFloat(latest.metric_value) : 0
        }),
        borderColor: `hsl(${index * 137.5 % 360}, 70%, 50%)`,
        backgroundColor: `hsla(${index * 137.5 % 360}, 70%, 50%, 0.2)`,
        pointBackgroundColor: `hsl(${index * 137.5 % 360}, 70%, 50%)`
      }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Compare financial performance across companies
        </p>
      </div>

      {/* Company Selection */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Select Companies to Compare
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {companies.map((company) => (
            <label key={company.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCompanies.includes(company.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCompanies([...selectedCompanies, company.id])
                  } else {
                    setSelectedCompanies(selectedCompanies.filter(id => id !== company.id))
                  }
                }}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-900 dark:text-white">{company.name}</span>
            </label>
          ))}
        </div>
      </div>

      {selectedCompanies.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No companies selected</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Select companies above to view analytics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Comparison */}
          <div className="card p-6">
            <div className="flex items-center space-x-2 mb-4">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Revenue Trends
              </h3>
            </div>
            {analyticsData.revenueComparison ? (
              <Line 
                data={analyticsData.revenueComparison}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Revenue (Millions USD)'
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No revenue data available
              </div>
            )}
          </div>

          {/* Profitability Comparison */}
          <div className="card p-6">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Profitability Comparison
              </h3>
            </div>
            {analyticsData.profitabilityTrends ? (
              <Bar 
                data={analyticsData.profitabilityTrends}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Profit (Millions USD)'
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No profitability data available
              </div>
            )}
          </div>

          {/* Inconsistency Analysis */}
          <div className="card p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Data Quality Issues
              </h3>
            </div>
            {analyticsData.inconsistencyAnalysis ? (
              <Bar 
                data={analyticsData.inconsistencyAnalysis}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Number of Issues'
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No inconsistency data available
              </div>
            )}
          </div>

          {/* Financial Ratios */}
          <div className="card p-6">
            <div className="flex items-center space-x-2 mb-4">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Financial Ratios
              </h3>
            </div>
            {analyticsData.financialRatios ? (
              <Radar 
                data={analyticsData.financialRatios}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                  },
                  scales: {
                    r: {
                      beginAtZero: true,
                    }
                  }
                }}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No financial ratios available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
