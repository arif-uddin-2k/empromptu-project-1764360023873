import React, { useState, useEffect } from 'react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useAuth } from '../contexts/AuthContext'
import { FileBarChart, Download, Plus, Search } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function Reports() {
  const { query } = useDatabase()
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'company_analysis',
    company_ids: [],
    date_range: 'all',
    include_inconsistencies: true,
    format: 'excel'
  })

  useEffect(() => {
    loadReports()
    loadCompanies()
  }, [])

  const loadReports = async () => {
    try {
      const result = await query(`
        SELECT r.*, u.email as created_by_email
        FROM reports r
        LEFT JOIN users u ON r.created_by = u.id
        ORDER BY r.created_at DESC
      `)
      
      setReports(result.data || [])
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const result = await query('SELECT id, name FROM companies ORDER BY name')
      setCompanies(result.data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  const generateReport = async (reportConfig) => {
    setGenerating(true)
    
    try {
      // Fetch data based on report configuration
      const reportData = await fetchReportData(reportConfig)
      
      // Generate report in requested format
      if (reportConfig.format === 'excel') {
        generateExcelReport(reportData, reportConfig)
      } else if (reportConfig.format === 'pdf') {
        generatePDFReport(reportData, reportConfig)
      } else if (reportConfig.format === 'csv') {
        generateCSVReport(reportData, reportConfig)
      }

      // Save report record
      await query(`
        INSERT INTO reports (name, type, parameters, created_by)
        VALUES ($1, $2, $3, $4)
      `, [
        reportConfig.name,
        reportConfig.type,
        JSON.stringify(reportConfig),
        user?.id
      ])

      loadReports()
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Error generating report: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const fetchReportData = async (config) => {
    const data = {}

    // Fetch companies data
    if (config.company_ids.length > 0) {
      const companiesResult = await query(`
        SELECT * FROM companies WHERE id = ANY($1)
      `, [config.company_ids])
      data.companies = companiesResult.data || []

      // Fetch financial statements
      const statementsResult = await query(`
        SELECT fs.*, c.name as company_name
        FROM financial_statements fs
        JOIN companies c ON fs.company_id = c.id
        WHERE fs.company_id = ANY($1)
        ORDER BY fs.year DESC, fs.quarter DESC
      `, [config.company_ids])
      data.statements = statementsResult.data || []

      // Fetch financial metrics
      const metricsResult = await query(`
        SELECT fm.*, fs.year, fs.quarter, c.name as company_name
        FROM financial_metrics fm
        JOIN financial_statements fs ON fm.statement_id = fs.id
        JOIN companies c ON fs.company_id = c.id
        WHERE fs.company_id = ANY($1)
        ORDER BY c.name, fs.year DESC, fs.quarter DESC
      `, [config.company_ids])
      data.metrics = metricsResult.data || []

      // Fetch inconsistencies if requested
      if (config.include_inconsistencies) {
        const inconsistenciesResult = await query(`
          SELECT i.*, fs.year, fs.quarter, c.name as company_name
          FROM inconsistencies i
          JOIN financial_statements fs ON i.statement_id = fs.id
          JOIN companies c ON fs.company_id = c.id
          WHERE fs.company_id = ANY($1)
          ORDER BY i.severity DESC, i.detected_at DESC
        `, [config.company_ids])
        data.inconsistencies = inconsistenciesResult.data || []
      }
    }

    return data
  }

  const generateExcelReport = (data, config) => {
    const wb = XLSX.utils.book_new()

    // Companies sheet
    if (data.companies) {
      const companiesWS = XLSX.utils.json_to_sheet(data.companies)
      XLSX.utils.book_append_sheet(wb, companiesWS, 'Companies')
    }

    // Financial metrics sheet
    if (data.metrics) {
      const metricsWS = XLSX.utils.json_to_sheet(data.metrics)
      XLSX.utils.book_append_sheet(wb, metricsWS, 'Financial Metrics')
    }

    // Inconsistencies sheet
    if (data.inconsistencies) {
      const inconsistenciesWS = XLSX.utils.json_to_sheet(data.inconsistencies)
      XLSX.utils.book_append_sheet(wb, inconsistenciesWS, 'Inconsistencies')
    }

    // Download file
    XLSX.writeFile(wb, `${config.name}.xlsx`)
  }

  const generatePDFReport = (data, config) => {
    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(20)
    doc.text(config.name, 20, 20)
    
    doc.setFontSize(12)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30)
    doc.text(`Created by: ${user?.email}`, 20, 40)

    let yPosition = 60

    // Companies summary
    if (data.companies) {
      doc.setFontSize(16)
      doc.text('Companies Overview', 20, yPosition)
      yPosition += 10

      const companyData = data.companies.map(c => [c.name, c.industry || 'N/A'])
      doc.autoTable({
        head: [['Company', 'Industry']],
        body: companyData,
        startY: yPosition,
        margin: { left: 20 }
      })
      yPosition = doc.lastAutoTable.finalY + 20
    }

    // Financial metrics summary
    if (data.metrics) {
      doc.setFontSize(16)
      doc.text('Key Financial Metrics', 20, yPosition)
      yPosition += 10

      const revenueMetrics = data.metrics.filter(m => m.metric_name === 'total_revenue')
      const metricsData = revenueMetrics.map(m => [
        m.company_name,
        m.year,
        m.quarter || 'Annual',
        `$${(parseFloat(m.metric_value) / 1000000).toFixed(1)}M`
      ])

      doc.autoTable({
        head: [['Company', 'Year', 'Period', 'Revenue']],
        body: metricsData,
        startY: yPosition,
        margin: { left: 20 }
      })
      yPosition = doc.lastAutoTable.finalY + 20
    }

    // Inconsistencies summary
    if (data.inconsistencies && data.inconsistencies.length > 0) {
      doc.setFontSize(16)
      doc.text('Data Quality Issues', 20, yPosition)
      yPosition += 10

      const inconsistencyData = data.inconsistencies.slice(0, 10).map(i => [
        i.company_name,
        i.inconsistency_type,
        i.severity,
        i.description.substring(0, 50) + '...'
      ])

      doc.autoTable({
        head: [['Company', 'Type', 'Severity', 'Description']],
        body: inconsistencyData,
        startY: yPosition,
        margin: { left: 20 }
      })
    }

    doc.save(`${config.name}.pdf`)
  }

  const generateCSVReport = (data, config) => {
    if (data.metrics) {
      const csvContent = [
        ['Company', 'Year', 'Quarter', 'Metric Name', 'Metric Value', 'Category'],
        ...data.metrics.map(m => [
          m.company_name,
          m.year,
          m.quarter || '',
          m.metric_name,
          m.metric_value,
          m.metric_category
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${config.name}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await generateReport(formData)
    setShowCreateModal(false)
    setFormData({
      name: '',
      type: 'company_analysis',
      company_ids: [],
      date_range: 'all',
      include_inconsistencies: true,
      format: 'excel'
    })
  }

  const filteredReports = reports.filter(report =>
    report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Generate and download financial analysis reports
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create Report</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search reports..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.map((report) => (
          <div key={report.id} className="card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
                  <FileBarChart className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {report.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {report.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • 
                    Created by {report.created_by_email} • 
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => generateReport(JSON.parse(report.parameters))}
                className="btn-secondary flex items-center space-x-2"
                disabled={generating}
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <FileBarChart className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No reports</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create your first financial analysis report.
          </p>
        </div>
      )}

      {/* Create Report Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Report
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Report Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Enter report name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Report Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input-field"
                >
                  <option value="company_analysis">Company Analysis</option>
                  <option value="comparative_analysis">Comparative Analysis</option>
                  <option value="inconsistency_report">Data Quality Report</option>
                  <option value="financial_summary">Financial Summary</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Companies
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2">
                  {companies.map((company) => (
                    <label key={company.id} className="flex items-center space-x-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.company_ids.includes(company.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              company_ids: [...formData.company_ids, company.id]
                            })
                          } else {
                            setFormData({
                              ...formData,
                              company_ids: formData.company_ids.filter(id => id !== company.id)
                            })
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">{company.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Export Format
                </label>
                <select
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  className="input-field"
                >
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="pdf">PDF Report</option>
                  <option value="csv">CSV Data</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="include_inconsistencies"
                  checked={formData.include_inconsistencies}
                  onChange={(e) => setFormData({ ...formData, include_inconsistencies: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="include_inconsistencies" className="text-sm text-gray-700 dark:text-gray-300">
                  Include data quality issues
                </label>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                  disabled={generating}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1 disabled:opacity-50"
                  disabled={generating || formData.company_ids.length === 0}
                >
                  {generating ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
