import React, { useState, useEffect } from 'react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useAuth } from '../contexts/AuthContext'
import { 
  Building2, 
  FileText, 
  AlertTriangle, 
  TrendingUp,
  DollarSign,
  BarChart3
} from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export default function Dashboard() {
  const { query } = useDatabase()
  const { user } = useAuth()
  const [stats, setStats] = useState({
    companies: 0,
    statements: 0,
    inconsistencies: 0,
    recentActivity: []
  })
  const [chartData, setChartData] = useState({
    revenue: null,
    inconsistencies: null,
    companies: null
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Load basic stats
      const companiesResult = await query('SELECT COUNT(*) as count FROM companies')
      const statementsResult = await query('SELECT COUNT(*) as count FROM financial_statements')
      const inconsistenciesResult = await query('SELECT COUNT(*) as count FROM inconsistencies WHERE severity = $1', ['high'])
      
      // Load recent activity
      const activityResult = await query(`
        SELECT 
          fs.id,
          c.name as company_name,
          fs.statement_type,
          fs.year,
          fs.quarter,
          fs.processed_at
        FROM financial_statements fs
        JOIN companies c ON fs.company_id = c.id
        ORDER BY fs.processed_at DESC
        LIMIT 5
      `)

      setStats({
        companies: companiesResult.data?.[0]?.count || 0,
        statements: statementsResult.data?.[0]?.count || 0,
        inconsistencies: inconsistenciesResult.data?.[0]?.count || 0,
        recentActivity: activityResult.data || []
      })

      // Load chart data
      loadChartData()
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  const loadChartData = async () => {
    try {
      // Revenue trend data
      const revenueResult = await query(`
        SELECT 
          c.name as company,
          fm.metric_value as revenue,
          fs.year
        FROM financial_metrics fm
        JOIN financial_statements fs ON fm.statement_id = fs.id
        JOIN companies c ON fs.company_id = c.id
        WHERE fm.metric_name = 'total_revenue'
        ORDER BY fs.year DESC
        LIMIT 20
      `)

      // Inconsistencies by severity
      const inconsistencyResult = await query(`
        SELECT severity, COUNT(*) as count
        FROM inconsistencies
        GROUP BY severity
      `)

      // Companies by industry
      const industryResult = await query(`
        SELECT industry, COUNT(*) as count
        FROM companies
        WHERE industry IS NOT NULL
        GROUP BY industry
      `)

      setChartData({
        revenue: {
          labels: revenueResult.data?.map(d => `${d.company} (${d.year})`) || [],
          datasets: [{
            label: 'Revenue (Millions)',
            data: revenueResult.data?.map(d => parseFloat(d.revenue) / 1000000) || [],
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.1
          }]
        },
        inconsistencies: {
          labels: inconsistencyResult.data?.map(d => d.severity) || [],
          datasets: [{
            data: inconsistencyResult.data?.map(d => parseInt(d.count)) || [],
            backgroundColor: [
              'rgba(239, 68, 68, 0.8)',
              'rgba(245, 158, 11, 0.8)',
              'rgba(34, 197, 94, 0.8)'
            ]
          }]
        },
        companies: {
          labels: industryResult.data?.map(d => d.industry) || [],
          datasets: [{
            label: 'Companies',
            data: industryResult.data?.map(d => parseInt(d.count)) || [],
            backgroundColor: 'rgba(59, 130, 246, 0.8)'
          }]
        }
      })
    } catch (error) {
      console.error('Error loading chart data:', error)
    }
  }

  const StatCard = ({ title, value, icon: Icon, color = 'blue' }) => (
    <div className="card p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg bg-${color}-100 dark:bg-${color}-900/20`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Welcome back, {user?.email}. Here's your financial analysis overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Companies"
          value={stats.companies}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Statements"
          value={stats.statements}
          icon={FileText}
          color="green"
        />
        <StatCard
          title="High Priority Issues"
          value={stats.inconsistencies}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Analysis Score"
          value="94%"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue Trends
          </h3>
          {chartData.revenue ? (
            <Line 
              data={chartData.revenue}
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

        {/* Inconsistencies by Severity */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Issues by Severity
          </h3>
          {chartData.inconsistencies ? (
            <Doughnut 
              data={chartData.inconsistencies}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No inconsistency data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity and Companies by Industry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h3>
          <div className="space-y-4">
            {stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.company_name} - {activity.statement_type}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Q{activity.quarter} {activity.year} • {new Date(activity.processed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No recent activity
              </p>
            )}
          </div>
        </div>

        {/* Companies by Industry */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Companies by Industry
          </h3>
          {chartData.companies ? (
            <Bar 
              data={chartData.companies}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Number of Companies'
                    }
                  }
                }
              }}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No company data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
