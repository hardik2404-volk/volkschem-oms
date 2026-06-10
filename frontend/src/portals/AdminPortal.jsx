import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import {
  LayoutDashboard, FileText, Package, Truck, Tag, DollarSign,
  Users, ClipboardList
} from 'lucide-react';

const adminMenu = [
  { icon: LayoutDashboard, label: 'Dashboard',    path: '/admin/dashboard', exact: true },
  { icon: FileText,        label: 'Quotations',   path: '/admin/quotations' },
  { icon: Truck,           label: 'Orders',        path: '/admin/orders' },
  { icon: Users,           label: 'Customers',     path: '/admin/customers' },
  { icon: Package,         label: 'Product Master', path: '/admin/products' },
  { icon: DollarSign,      label: 'Bulk Price',    path: '/admin/bulk-prices' },
  { icon: Tag,             label: 'Cost Sheet',    path: '/admin/cost-sheet' },
  { icon: ClipboardList,   label: 'Staff',         path: '/admin/staff' },
  { icon: ClipboardList,   label: 'Logs',          path: '/admin/logs' },
];

export default function AdminPortal() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-surface-alt">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex">
        <Sidebar
          menuItems={adminMenu}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main
          className={`flex-1 p-6 transition-all duration-300 min-h-[calc(100vh-4rem)] ${
            sidebarOpen ? 'lg:ml-0' : 'lg:ml-0'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
