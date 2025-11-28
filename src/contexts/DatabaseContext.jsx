import React, { createContext, useContext, useEffect } from 'react'

const DatabaseContext = createContext()

export function useDatabase() {
  return useContext(DatabaseContext)
}

export function DatabaseProvider({ children }) {
  useEffect(() => {
    initializeDatabase()
  }, [])

  const initializeDatabase = async () => {
    try {
      const schema = {
        tables: [
          {
            name: "users",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "email", type: "text", nullable: false },
              { name: "password_hash", type: "text", nullable: false },
              { name: "role", type: "text", nullable: false, default: "'user'" },
              { name: "team_id", type: "uuid" },
              { name: "created_at", type: "timestamptz", default: "now()" },
              { name: "last_login", type: "timestamptz" }
            ]
          },
          {
            name: "teams",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "name", type: "text", nullable: false },
              { name: "description", type: "text" },
              { name: "created_at", type: "timestamptz", default: "now()" }
            ]
          },
          {
            name: "user_permissions",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "user_id", type: "uuid", nullable: false },
              { name: "permission_type", type: "text", nullable: false },
              { name: "resource_id", type: "uuid" }
            ]
          },
          {
            name: "audit_logs",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "user_id", type: "uuid", nullable: false },
              { name: "action", type: "text", nullable: false },
              { name: "resource_type", type: "text", nullable: false },
              { name: "resource_id", type: "uuid" },
              { name: "timestamp", type: "timestamptz", default: "now()" },
              { name: "details", type: "text" }
            ]
          },
          {
            name: "companies",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "name", type: "text", nullable: false },
              { name: "industry", type: "text" },
              { name: "created_at", type: "timestamptz", default: "now()" },
              { name: "team_id", type: "uuid" }
            ]
          },
          {
            name: "financial_statements",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "company_id", type: "uuid", nullable: false },
              { name: "statement_type", type: "text", nullable: false },
              { name: "period", type: "text", nullable: false },
              { name: "year", type: "bigint", nullable: false },
              { name: "quarter", type: "bigint" },
              { name: "file_path", type: "text" },
              { name: "processed_at", type: "timestamptz" },
              { name: "uploaded_by", type: "uuid", nullable: false }
            ]
          },
          {
            name: "financial_metrics",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "statement_id", type: "uuid", nullable: false },
              { name: "metric_name", type: "text", nullable: false },
              { name: "metric_value", type: "numeric" },
              { name: "metric_category", type: "text", nullable: false }
            ]
          },
          {
            name: "inconsistencies",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "statement_id", type: "uuid", nullable: false },
              { name: "inconsistency_type", type: "text", nullable: false },
              { name: "description", type: "text", nullable: false },
              { name: "severity", type: "text", nullable: false },
              { name: "detected_at", type: "timestamptz", default: "now()" }
            ]
          },
          {
            name: "reports",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "name", type: "text", nullable: false },
              { name: "type", type: "text", nullable: false },
              { name: "parameters", type: "text" },
              { name: "created_by", type: "uuid", nullable: false },
              { name: "created_at", type: "timestamptz", default: "now()" }
            ]
          },
          {
            name: "dashboards",
            columns: [
              { name: "id", type: "uuid", nullable: false, default: "gen_random_uuid()" },
              { name: "name", type: "text", nullable: false },
              { name: "layout_config", type: "text" },
              { name: "created_by", type: "uuid", nullable: false },
              { name: "team_id", type: "uuid" },
              { name: "created_at", type: "timestamptz", default: "now()" }
            ]
          }
        ],
        indexes: [
          { table: "users", columns: ["email"], name: "users_email_uq", unique: true },
          { table: "companies", columns: ["name"], name: "companies_name_idx" },
          { table: "financial_statements", columns: ["company_id", "year", "quarter"], name: "statements_company_period_idx" },
          { table: "financial_metrics", columns: ["statement_id", "metric_name"], name: "metrics_statement_name_idx" },
          { table: "inconsistencies", columns: ["statement_id", "severity"], name: "inconsistencies_statement_severity_idx" }
        ]
      }

      const response = await fetch('https://builder.empromptu.ai/api_tools/database/schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 4b82f096e899fe27871d083ae66ddd01',
          'X-Generated-App-ID': 'ae40c6ff-a693-48ae-ae9d-f44b3831f48e',
          'X-Usage-Key': '2b0185b0bd6d7d7ebe2369814e91bb81'
        },
        body: JSON.stringify(schema)
      })

      if (response.ok || response.status === 304) {
        console.log('Database schema initialized successfully')
      } else {
        console.error('Failed to initialize database schema')
      }
    } catch (error) {
      console.error('Database initialization error:', error)
    }
  }

  const query = async (sql, params = []) => {
    try {
      const response = await fetch('https://builder.empromptu.ai/api_tools/database/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 4b82f096e899fe27871d083ae66ddd01',
          'X-Generated-App-ID': 'ae40c6ff-a693-48ae-ae9d-f44b3831f48e',
          'X-Usage-Key': '2b0185b0bd6d7d7ebe2369814e91bb81'
        },
        body: JSON.stringify({ query: sql, params })
      })

      return await response.json()
    } catch (error) {
      console.error('Database query error:', error)
      return { success: false, error: error.message }
    }
  }

  const value = {
    query
  }

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  )
}
