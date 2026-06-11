import { useState, useEffect } from 'react';
import { adminService } from '../../services/dataService';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';
import { Plus, Eye, ToggleLeft, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import EmployeePerformanceModal from './EmployeePerformanceModal';

export default function StaffManagement() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ full_name: '', username: '', password: '', role: 'employee', phone: '', joining_date: '' });

  const fetchStaff = () => {
    setLoading(true);
    adminService.getStaff()
      .then(({ data }) => setStaff(data.data || []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(); }, []);

  const openAdd = () => {
    setEditing(false);
    setSelectedStaff(null);
    setForm({ full_name: '', username: '', password: '', role: 'employee', phone: '', joining_date: '' });
    setAddOpen(true);
  };

  const openEdit = (staffMember) => {
    setEditing(true);
    setSelectedStaff(staffMember);
    setForm({
      full_name: staffMember.full_name || '',
      username: staffMember.username || '',
      password: '',
      role: staffMember.role || 'employee',
      phone: staffMember.phone || '',
      joining_date: staffMember.joining_date ? new Date(staffMember.joining_date).toISOString().split('T')[0] : '',
    });
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.username.trim() || (!editing && !form.password.trim())) {
      toast.error('Name, username and password are required.'); return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await adminService.updateStaff(selectedStaff.id, payload);
        toast.success('Staff member updated.');
      } else {
        await adminService.createStaff(form);
        toast.success('Staff member added.');
      }
      setAddOpen(false);
      fetchStaff();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  const handleToggleStatus = async (staffMember) => {
    if (staffMember.id === user?.id) { toast.error('You cannot deactivate yourself.'); return; }
    if (!confirm(`${staffMember.is_active ? 'Deactivate' : 'Restore'} ${staffMember.full_name}?`)) return;
    try {
      await adminService.toggleStatus(staffMember.id);
      toast.success(`${staffMember.full_name} ${staffMember.is_active ? 'deactivated' : 'restored'}.`);
      fetchStaff();
    } catch { /* handled */ }
  };

  const handlePermanentDelete = async (staffMember) => {
    if (staffMember.id === user?.id) { toast.error('You cannot delete yourself.'); return; }
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${staffMember.full_name}? This cannot be undone.`)) return;
    try {
      await adminService.deleteStaff(staffMember.id);
      toast.success(`${staffMember.full_name} permanently deleted.`);
      fetchStaff();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(err.response.data.message || 'Cannot delete user with existing records. Deactivate them instead.');
      } else {
        toast.error('Failed to delete user.');
      }
    }
  };

  const columns = [
    { key: 'full_name', header: 'Name', accessor: 'full_name' },
    { key: 'username', header: 'Username', accessor: 'username' },
    { key: 'role', header: 'Role', render: (r) => <Badge status={r.role} /> },
    { key: 'phone', header: 'Phone', render: (r) => r.phone || '-' },
    { key: 'joining_date', header: 'Joined', render: (r) => r.joining_date ? new Date(r.joining_date).toLocaleDateString('en-IN') : '-' },
    { key: 'last_login', header: 'Last Login', render: (r) => r.last_login ? new Date(r.last_login).toLocaleString('en-IN') : 'Never' },
    { key: 'is_active', header: 'Status', render: (r) => <Badge status={r.is_active ? 'active' : 'inactive'} /> },
    { key: 'actions', header: 'Actions', sortable: false, render: (r) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
          className="p-1.5 hover:bg-surface-alt rounded-md text-text-secondary hover:text-primary transition-colors" title="Edit">
          <Pencil size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setSelectedStaff(r); setPerformanceOpen(true); }}
          className="p-1.5 hover:bg-surface-alt rounded-md text-text-secondary hover:text-primary transition-colors" title="View Performance">
          <Eye size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(r); }}
          className={`p-1.5 rounded-md transition-colors ${r.is_active ? 'hover:bg-warning-light text-text-secondary hover:text-warning-dark' : 'hover:bg-success-light text-text-secondary hover:text-success'}`}
          title={r.is_active ? 'Deactivate' : 'Restore'}>
          <ToggleLeft size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(r); }}
          className="p-1.5 hover:bg-error-light rounded-md text-text-secondary hover:text-error transition-colors" title="Permanently Delete">
          <Trash2 size={16} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Staff Management</h1>
        <Button variant="warning" icon={Plus} onClick={openAdd}>Add User</Button>
      </div>

      <Table columns={columns} data={staff} loading={loading} searchPlaceholder="Search staff..." />

      {/* Add/Edit User Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title={editing ? "Edit User" : "Add New User"}
        footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>{editing ? "Update User" : "Create User"}</Button></>}>
        <div className="space-y-4">
          <Input label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required disabled={editing} />
            <Input label={editing ? "New Password (Optional)" : "Password"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Role" type="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              options={[{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }, { value: 'factory_admin', label: 'Factory Admin' }]} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input label="Joining Date" type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
        </div>
      </Modal>

      <EmployeePerformanceModal 
        isOpen={performanceOpen} 
        onClose={() => setPerformanceOpen(false)} 
        employee={selectedStaff} 
      />
    </div>
  );
}
