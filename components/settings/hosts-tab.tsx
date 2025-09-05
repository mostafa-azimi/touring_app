"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Edit, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Host {
  id: string
  first_name: string
  last_name: string
  email: string
  created_at: string
}

export function HostsTab() {
  const [hosts, setHosts] = useState<Host[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHost, setEditingHost] = useState<Host | null>(null)
  const [formData, setFormData] = useState({ first_name: "", last_name: "", email: "" })
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchHosts()
  }, [])

  const fetchHosts = async () => {
    try {
      const { data, error } = await supabase.from("team_members").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setHosts(data || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch hosts",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Debug: Log the form data being submitted
      console.log("Submitting host data:", formData)
      
      // Format data to match current database structure (name field required)
      const dbData = {
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email
      }
      
      if (editingHost) {
        const { error } = await supabase.from("team_members").update(dbData).eq("id", editingHost.id)
        if (error) {
          console.error("Host update error:", error)
          throw error
        }
        toast({ title: "Success", description: "Host updated successfully" })
      } else {
        const { error } = await supabase.from("team_members").insert([dbData])
        if (error) {
          console.error("Host insert error:", error)
          throw error
        }
        toast({ title: "Success", description: "Host created successfully" })
      }

      setFormData({ first_name: "", last_name: "", email: "" })
      setEditingHost(null)
      setIsDialogOpen(false)
      fetchHosts()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save host",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (host: Host) => {
    setEditingHost(host)
    setFormData({ first_name: host.first_name, last_name: host.last_name, email: host.email })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this host?")) return

    try {
      const { error } = await supabase.from("team_members").delete().eq("id", id)
      if (error) throw error
      toast({ title: "Success", description: "Host deleted successfully" })
      fetchHosts()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete host",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({ first_name: "", last_name: "", email: "" })
    setEditingHost(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Hosts</h3>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Host
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHost ? "Edit Host" : "Add New Host"}</DialogTitle>
              <DialogDescription>
                {editingHost ? "Update the host information." : "Add a new tour host."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Smith"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john.smith@company.com"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className={isLoading ? "cursor-wait" : ""}
                >
                  {isLoading ? "Saving..." : editingHost ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">First Name</TableHead>
              <TableHead className="w-[18%]">Last Name</TableHead>
              <TableHead className="w-[35%]">Email</TableHead>
              <TableHead className="w-[15%] hidden md:table-cell">Created</TableHead>
              <TableHead className="w-[14%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading hosts...
                </TableCell>
              </TableRow>
            ) : hosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No hosts found. Add your first host to get started.
                </TableCell>
              </TableRow>
            ) : (
              hosts.map((host) => (
                <TableRow key={host.id}>
                  <TableCell className="font-medium">
                    <div className="truncate" title={host.first_name || '-'}>
                      {host.first_name || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="truncate" title={host.last_name || '-'}>
                      {host.last_name || '-'}
                    </div>
                    {/* Show created date on mobile */}
                    <div className="md:hidden text-xs text-muted-foreground mt-1">
                      {new Date(host.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="truncate" title={host.email}>
                      {host.email}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(host.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(host)} className="w-full">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(host.id)} className="w-full">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
