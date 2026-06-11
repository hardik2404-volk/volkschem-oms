import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/Login';

// Admin Portal
import AdminPortal from '../portals/AdminPortal';
import AdminDashboard from '../pages/admin/AdminDashboard';
import QuotationManagement from '../pages/admin/QuotationManagement';
import ProductMaster from '../pages/admin/ProductMaster';
import BulkPriceSection from '../pages/admin/BulkPriceSection';
import CostSheetManager from '../pages/admin/CostSheetManager';
import StaffManagement from '../pages/admin/StaffManagement';
import LoginLogs from '../pages/admin/LoginLogs';
import AdminOrdersView from '../pages/admin/AdminOrdersView';
import CustomerDirectory from '../pages/admin/CustomerDirectory';

// Employee Portal
import EmployeePortal from '../portals/EmployeePortal';

import MyOrders from '../pages/employee/MyOrders';
import BulkPriceSearch from '../pages/employee/BulkPriceSearch';
import ProductQuotationWizard from '../quotation/ProductQuotationWizard';
import BulkQuotationForm from '../quotation/BulkQuotationForm';

// Factory Portal
import FactoryPortal from '../portals/FactoryPortal';
import FactoryOrdersList from '../pages/factory/FactoryOrdersList';
import DispatchManager from '../pages/factory/DispatchManager';

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const portalMap = { admin: '/admin', employee: '/employee', factory_admin: '/factory' };
  return <Navigate to={portalMap[user?.role] || '/login'} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Admin Portal */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminPortal />}>
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="quotations" element={<QuotationManagement />} />
          <Route path="create-quotation" element={<ProductQuotationWizard />} />
          <Route path="create-bulk" element={<BulkQuotationForm />} />
          <Route path="orders" element={<AdminOrdersView />} />
          <Route path="products" element={<ProductMaster />} />
          <Route path="bulk-prices" element={<BulkPriceSection />} />
          <Route path="cost-sheet" element={<CostSheetManager />} />
          <Route path="customers" element={<CustomerDirectory />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="logs" element={<LoginLogs />} />
        </Route>
      </Route>

      {/* Employee Portal */}
      <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
        <Route path="/employee" element={<EmployeePortal />}>
          <Route index element={<Navigate to="/employee/my-orders" replace />} />
          <Route path="my-orders" element={<MyOrders />} />
          <Route path="bulk-price" element={<BulkPriceSearch />} />
          <Route path="cost-sheet" element={<CostSheetManager />} />
          <Route path="create-quotation" element={<ProductQuotationWizard />} />
          <Route path="create-bulk" element={<BulkQuotationForm />} />
          <Route path="customers" element={<CustomerDirectory />} />
        </Route>
      </Route>

      {/* Factory Portal */}
      <Route element={<ProtectedRoute allowedRoles={['factory_admin']} />}>
        <Route path="/factory" element={<FactoryPortal />}>
          <Route index element={<Navigate to="/factory/orders" replace />} />
          <Route path="orders" element={<FactoryOrdersList />} />
          <Route path="dispatch" element={<DispatchManager />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
