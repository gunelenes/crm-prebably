import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "./pages/Layout";
import LoginPage from "./pages/LoginPage";

// Sayfalar lazy yüklenir → ilk bundle küçülür, her route ayrı chunk.
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ContactsPage = lazy(() => import("./pages/contacts/ContactsPage"));
const PaymentsPage = lazy(() => import("./pages/payments/PaymentsPage"));
const AdvertisingPage = lazy(() => import("./pages/advertising/AdvertisingPage"));
const CampaignStatusPage = lazy(() => import("./pages/advertising/CampaignStatusPage"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const QuickRepliesPage = lazy(() => import("./pages/QuickRepliesPage"));
const IssuesPage = lazy(() => import("./pages/issues/IssuesPage"));
const ParametersPage = lazy(() => import("./pages/parameters/ParametersPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SeminarFormsPage = lazy(() => import("./pages/seminar-forms/SeminarFormsPage"));
const FormRegistrationsPage = lazy(() => import("./pages/seminar-forms/FormRegistrationsPage"));
const PublicFormPage = lazy(() => import("./pages/public/PublicFormPage"));
const SystemHealthPage = lazy(() => import("./pages/system/SystemHealthPage"));

function PublicFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-600">
      <div className="animate-spin border-4 border-white/70 border-t-transparent rounded-full w-10 h-10" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/f/:slug"
        element={
          <Suspense fallback={<PublicFallback />}>
            <PublicFormPage />
          </Suspense>
        }
      />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="mesajlar" element={<MessagesPage />} />
        <Route path="kisiler" element={<ContactsPage />} />
        <Route path="hatirlatmalar" element={<RemindersPage />} />
        <Route path="odemeler" element={
          <ProtectedRoute adminOnly><PaymentsPage /></ProtectedRoute>
        } />
        <Route path="reklam-analizi" element={
          <ProtectedRoute adminOnly><AdvertisingPage /></ProtectedRoute>
        } />
        <Route path="kampanya-durumlari" element={
          <ProtectedRoute adminOnly><CampaignStatusPage /></ProtectedRoute>
        } />
        <Route path="grafikler" element={
          <ProtectedRoute adminOnly><ReportsPage /></ProtectedRoute>
        } />
        <Route path="hazir-mesajlar" element={<QuickRepliesPage />} />
        <Route path="seminer-formlari" element={<SeminarFormsPage />} />
        <Route path="seminer-formlari/:id/kayitlar" element={<FormRegistrationsPage />} />
        <Route path="hatalar" element={<IssuesPage />} />
        <Route path="parametreler" element={<ParametersPage />} />
        <Route path="statuler" element={<Navigate to="/parametreler" replace />} />
        <Route path="kullanicilar" element={
          <ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>
        } />
        <Route path="gelistirici" element={
          <ProtectedRoute ownerOnly><SystemHealthPage /></ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
