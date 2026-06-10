import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import { LayoutDashboard, Plus, FileText, Search } from 'lucide-react';

import { Users } from 'lucide-react';

const employeeMenu = [
  { icon: Plus,             label: 'Create Quotation', path: '/employee/create-quotation' },
  { icon: FileText,         label: 'My Orders',        path: '/employee/my-orders' },
  { icon: Plus,             label: 'Create Bulk Quotation', path: '/employee/create-bulk' },
  { icon: Search,           label: 'Search Bulk Price', path: '/employee/bulk-price' },
  { icon: Users,            label: 'Customer Directory',path: '/employee/customers' },
];

export default function EmployeePortal() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-surface-alt">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex">
        <Sidebar
          menuItems={employeeMenu}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 p-4 md:p-6 transition-all duration-300 min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
