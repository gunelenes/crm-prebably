import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "./pages/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import MessagesPage from "./pages/MessagesPage";
import ContactsPage from "./pages/contacts/ContactsPage";
import PaymentsPage from "./pages/payments/PaymentsPage";
import RemindersPage from "./pages/RemindersPage";
import QuickRepliesPage from "./pages/QuickRepliesPage";
import ParametersPage from "./pages/parameters/ParametersPage";
import UsersPage from "./pages/UsersPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="mesajlar" element={<MessagesPage />} />
        <Route path="kisiler" element={<ContactsPage />} />
        <Route path="hatirlatmalar" element={<RemindersPage />} />
        <Route path="odemeler" element={
          <ProtectedRoute adminOnly><PaymentsPage /></ProtectedRoute>
        } />
        <Route path="hazir-mesajlar" element={<QuickRepliesPage />} />
        <Route path="parametreler" element={<ParametersPage />} />
        <Route path="statuler" element={<Navigate to="/parametreler" replace />} />
        <Route path="kullanicilar" element={
          <ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
