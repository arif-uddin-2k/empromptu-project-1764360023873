import React, { useState, useEffect } from 'react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useAuth } from '../contexts/AuthContext'
import { 
  FileText, 
  Upload, 
  Link as LinkIcon, 
  Search, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Download
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export default function Statements() {
  const { query } = useDatabase()
  const { user } = useAuth()
  const [statements, setStatements] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadMethod, setUploadMethod] = useState('file') // 'file' or 'url'
  const [formData, setFormData] = useState({
    company_id: '',
    statement_type: 'income_statement',
    year: new Date().getFullYear(),
    quarter: '',
    file: null,
    url: ''
  })

  useEffect(() => {
    loadStatements()
    loadCompanies()
  }, [])

  const loadStatements = async () => {
    try {
      const result = await query(`
        SELECT 
          fs.*,
          c.name as company_name,
          COUNT(i.id) as inconsistency_count,
          COUNT(fm.id) as metrics_count
        FROM financial_statements fs
        JOIN companies c ON fs.company_id = c.id
        LEFT JOIN inconsistencies i ON fs.id = i.statement_id
        LEFT JOIN financial_metrics fm ON fs.id = fm.statement_id
        GROUP BY fs.id, c.name
        ORDER BY fs.processed_at DESC NULLS LAST, fs.year DESC, fs.quarter DESC
      `)
      
      setStatements(result.data || [])
    } catch (error) {
      console.error('Error loading statements:', error)
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

  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let fullText = ''

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map(item => item.str).join(' ')
        fullText += pageText + '\n'
      }

      return fullText
    } catch (error) {
      console.error('Error extracting PDF text:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

  const extractFinancialData = async (text) => {
    try {
      const response = await fetch('https://builder.empromptu.ai/api_tools/apply_prompt_to_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 4b82f096e899fe27871d083ae66ddd01',
          'X-Generated-App-ID': 'ae40c6ff-a693-48ae-ae9d-f44b3831f48e',
          'X-Usage-Key': '2b0185b0bd6d7d7ebe2369814e91bb81'
        },
        body: JSON.stringify({
          prompt_name: 'extract_financial_data',
          input_data: {
            pdf_text: text
          },
          return_type: 'structured'
        })
      })

      const result = await response.json()
      return result.value
    } catch (error) {
      console.error('Error extracting financial data:', error)
      throw new Error('Failed to extract financial data')
    }
  }

  const detectInconsistencies = async (financialData) => {
    try {
      const response = await fetch('https://builder.empromptu.ai/api_tools/apply_prompt_to_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 4b82f096e899fe27871d083ae66ddd01',
          'X-Generated-App-ID': 'ae40c6ff-a693-48ae-ae9d-f44b3831f48e',
          'X-Usage-Key': '2b0185b0bd6d7d7ebe2369814e91bb81'
        },
        body: JSON.stringify({
          prompt_name: 'detect_inconsistencies',
          input_data: {
            financial_data: JSON.stringify(financialData)
          },
          return_type: 'structured'
        })
      })

      const result = await response.json()
      return result.value
    } catch (error) {
      console.error('Error detecting inconsistencies:', error)
      return []
    }
  }

  const uploadToArchive = async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('https://builder.empromptu.ai/api_tools/archives/4cacbd0f-3edf-4b45-b788-f1f6907579e1', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 4b82f096e899fe27871d083ae66ddd01',
          'X-Generated-App-ID': 'ae40c6ff-a693-48ae-ae9d-f44b3831f48e',
          'X-Usage-Key': '2b0185b0bd6d7d7ebe2369814e91bb81'
        },
        body: formData
      })

      const result = await response.json()
      return result[0]?.status === 'success' ? file.name : null
    } catch (error) {
      console.error('Error uploading to archive:', error)
      return null
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setProcessing(true)

    try {
      let pdfText = ''
      let filePath = null

      if (uploadMethod === 'file' && formData.file) {
        // Upload file to archive
        filePath = await uploadToArchive(formData.file)
        if (!filePath) {
          throw new Error('Failed to upload file to archive')
        }

        // Extract text from PDF
        pdfText = await extractTextFromPDF(formData.file)
      } else if (uploadMethod === 'url' && formData.url) {
        // Download PDF from URL and extract text
        const response = await fetch('https://builder.empromptu.ai/api_tools/get_data_from_url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 4b82f096e899fe27871d083ae66ddd01',
            'X-Generated-App-ID': 'ae40c6ff-a693-48ae-ae9d-f44b3831f48e',
            'X-Usage-Key': '2b0185b0bd6d7d7ebe2369814e91bb81'
          },
          body: JSON.stringify({
            input_data: formData.url
          })
        })

        const urlResult = await response.json()
        pdfText = urlResult.text
        filePath = formData.url
      }

      // Create financial statement record
      const statementResult = await query(`
        INSERT INTO financial_statements 
        (company_id, statement_type, period, year, quarter, file_path, uploaded_by, processed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `, [
        formData.company_id,
        formData.statement_type,
        formData.quarter ? `Q${formData.quarter}` : 'Annual',
        formData.year,
        formData.quarter || null,
        filePath,
        user?.id
      ])

      const statementId = statementResult.data[0].id

      // Extract financial data
      const financialData = await extractFinancialData(pdfText)

      // Store financial metrics
      if (financialData && Array.isArray(financialData)) {
        for (const metric of financialData) {
          if (metric.metric_name && metric.metric_value !== undefined) {
            await query(`
              INSERT INTO financial_metrics (statement_id, metric_name, metric_value, metric_category)
              VALUES ($1, $2, $3, $4)
            `, [
              statementId,
              metric.metric_name,
              parseFloat(metric.metric_value) || 0,
              metric.metric_category || 'general'
            ])
          }
        }
      }

      // Detect inconsistencies
      const inconsistencies = await detectInconsistencies(financialData)

      // Store inconsistencies
      if (inconsistencies && Array.isArray(inconsistencies)) {
        for (const inconsistency of inconsistencies) {
          if (inconsistency.inconsistency_type && inconsistency.description) {
            await query(`
              INSERT INTO inconsistencies (statement_id, inconsistency_type, description, severity)
              VALUES ($1, $2, $3, $4)
            `, [
              statementId,
              inconsistency.inconsistency_type,
              inconsistency.description,
              inconsistency.severity || 'medium'
            ])
          }
        }
      }

      // Reset form and reload data
      setFormData({
        company_id: '',
        statement_type: 'income_statement',
        year: new Date().getFullYear(),
        quarter: '',
        file: null,
        url: ''
      })
      setShowUploadModal(false)
      loadStatements()

    } catch (error) {
      console.error('Error processing statement:', error)
      alert('Error processing financial statement: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const getStatusIcon = (statement) => {
    if (!statement.processed_at) {
      return <Clock className="h-5 w-5 text-yellow-500" />
    }
    if (statement.inconsistency_count > 0) {
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />
  }

  const getStatusText = (statement) => {
    if (!statement.processed_at) return 'Processing'
    if (statement.inconsistency_count > 0) return `${statement.inconsistency_count} Issues`
    return 'Processed'
  }

  const filteredStatements = statements.filter(statement =>
    statement.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    statement.statement_type.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financial Statements</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Upload and analyze financial statements
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Statement</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search statements..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Statements Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Metrics
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Processed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStatements.map((statement) => (
                <tr key={statement.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {statement.company_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {statement.statement_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {statement.quarter ? `Q${statement.quarter} ` : ''}{statement.year}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(statement)}
                      <span className="text-sm text-gray-900 dark:text-white">
                        {getStatusText(statement)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {statement.metrics_count} metrics
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {statement.processed_at ? new Date(statement.processed_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900 mr-3">
                      View
                    </button>
                    <button className="text-gray-400 hover:text-gray-600">
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredStatements.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No statements</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by uploading a financial statement.
          </p>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upload Financial Statement
            </h2>
            
            {/* Upload Method Tabs */}
            <div className="flex space-x-1 mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setUploadMethod('file')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  uploadMethod === 'file'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Upload className="h-4 w-4 inline mr-1" />
                File Upload
              </button>
              <button
                onClick={() => setUploadMethod('url')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  uploadMethod === 'url'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <LinkIcon className="h-4 w-4 inline mr-1" />
                URL
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company
                </label>
                <select
                  required
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select a company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Statement Type
                </label>
                <select
                  value={formData.statement_type}
                  onChange={(e) => setFormData({ ...formData, statement_type: e.target.value })}
                  className="input-field"
                >
                  <option value="income_statement">Income Statement</option>
                  <option value="balance_sheet">Balance Sheet</option>
                  <option value="cash_flow">Cash Flow Statement</option>
                  <option value="annual_report">Annual Report</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    required
                    min="2000"
                    max="2030"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quarter (Optional)
                  </label>
                  <select
                    value={formData.quarter}
                    onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Annual</option>
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </div>
              </div>
              
              {uploadMethod === 'file' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    PDF File
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    required
                    onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                    className="input-field"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    PDF URL
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="input-field"
                    placeholder="https://example.com/statement.pdf"
                  />
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    setFormData({
                      company_id: '',
                      statement_type: 'income_statement',
                      year: new Date().getFullYear(),
                      quarter: '',
                      file: null,
                      url: ''
                    })
                  }}
                  className="btn-secondary flex-1"
                  disabled={processing}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1 disabled:opacity-50"
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Upload & Analyze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
