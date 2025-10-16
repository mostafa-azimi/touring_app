'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  companyName?: string
  isAdmin: boolean
  lastLoginAt?: string
  createdAt: string
}

export function AdminPanel() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [resetForm, setResetForm] = useState({
    userId: '',
    newPassword: ''
  })
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  // Only show admin panel to admin users
  if (!user?.isAdmin) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Admin access required</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">You must be an admin to access this panel.</p>
        </CardContent>
      </Card>
    )
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    setResetMessage('')

    try {
      const response = await fetch('/api/auth/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetForm)
      })

      const data = await response.json()
      if (data.success) {
        setResetMessage(`✅ ${data.message}`)
        setResetForm({ userId: '', newPassword: '' })
      } else {
        setResetMessage(`❌ ${data.error}`)
      }
    } catch (error) {
      setResetMessage('❌ Failed to reset password')
    } finally {
      setResetLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>Manage users and reset passwords</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Password Reset Form */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Reset User Password</h3>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userId">Select User</Label>
                  <select
                    id="userId"
                    value={resetForm.userId}
                    onChange={(e) => setResetForm({...resetForm, userId: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    required
                    disabled={resetLoading}
                  >
                    <option value="">Choose a user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({...resetForm, newPassword: e.target.value})}
                    placeholder="Enter new password (min 6 characters)"
                    required
                    disabled={resetLoading}
                  />
                </div>
                {resetMessage && (
                  <div className={`text-sm ${resetMessage.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>
                    {resetMessage}
                  </div>
                )}
                <Button type="submit" disabled={resetLoading}>
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            </div>

            {/* Users Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4">All Users ({users.length})</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.firstName} {u.lastName}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{u.companyName || '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            u.isAdmin ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {u.isAdmin ? 'Admin' : 'User'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
