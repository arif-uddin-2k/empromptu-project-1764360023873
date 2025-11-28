import React, { useState, useEffect } from 'react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useAuth } from '../contexts/AuthContext'
import { Building2, Plus, Search, Edit, Trash2 } from 'lucide-react'

export default function Companies() {
  const { query } = useDatabase()
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    industry: ''
  })

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      const result = await query(`
        SELECT 
          c.*,
          COUNT(fs.id) as statement_count
        FROM companies c
        LEFT JOIN financial_statements fs ON c.id = fs.company_id
        GROUP BY c.id, c.name, c.industry, c.created_at, c.team_id
        ORDER BY c.name
      `)
      
      setCompanies(result.data || [])
    } catch (error) {
      console.error('Error loading companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (editingCompany) {
        await query(
          'UPDATE companies SET name = $1, industry = $2 WHERE id = $3',
          [formData.name, formData.industry, editingCompany.id]
        )
      } else {
        await query(
          'INSERT INTO companies (name, industry, team_id) VALUES ($1, $2, $3)',
          [formData.name, formData.industry, user?.team_id]
        )
      }
      
      setFormData({ name: '', industry: '' })
      setShowAddModal(false)
      setEditingCompany(null)
      loadCompanies()
    } catch (error) {
      console.error('Error saving company:', error)
    }
  }

  const handleEdit = (company) => {
    setEditingCompany(company)
    setFormData({
      name: company.name,
      industry: company.industry || ''
    })
    setShowAddModal(true)
  }

  const handleDelete = async (companyId) => {
    if (window.confirm('Are you sure you want to delete this company? This will also delete all associated financial statements.')) {
      try {
        await query('DELETE FROM companies WHERE id = $1', [companyId])
        loadCompanies()
      } catch (error) {
        console.error('Error deleting company:', error)
      }
    }
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.industry && company.industry.toLowerCase().includes(searchTerm.toLowerCase()))
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Companies</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage companies and their financial statements
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCompany(null)
            setFormData({ name: '', industry: '' })
            setShowAddModal(true)
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Company</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search companies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map((company) => (
          <div key={company.id} className="card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {company.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {company.industry || 'No industry specified'}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(company)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(company.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Statements:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {company.statement_count}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600 dark:text-gray-400">Added:</span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(company.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCompanies.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No companies</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by adding a new company.
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingCompany ? 'Edit Company' : 'Add New Company'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Enter company name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Technology, Healthcare"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingCompany(null)
                    setFormData({ name: '', industry: '' })
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingCompany ? 'Update' : 'Add'} Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
