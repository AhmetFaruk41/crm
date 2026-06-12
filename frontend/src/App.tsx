import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Loading from './components/Loading';
import { ConfirmHost } from './components/ConfirmDialog';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { UsersList, UserForm } from './pages/Users';
import { ClientsList, ClientForm } from './pages/Clients';
import { OffersList, OfferForm } from './pages/Offers';
import { OfferTemplatesList, OfferTemplateForm } from './pages/OfferTemplates';
import { AgreementsList, AgreementForm } from './pages/Agreements';
import { ProjectsList, ProjectDetail, ProjectForm } from './pages/Projects';
import { BillingsList, BillingsDetail } from './pages/Billings';
import { PersonnelList, PersonnelForm } from './pages/Personnel';
import { DomainsList, DomainForm } from './pages/Domains';
import Finance from './pages/Finance';
import { LeadsList, LeadDetailModal, LeadForm } from './pages/Leads';
import { BlogList, BlogForm } from './pages/Blog';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <ConfirmHost />
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />

          <Route path="leads/new" element={<LeadForm />} />
          <Route path="leads/:id/edit" element={<LeadForm />} />
          <Route path="leads" element={<LeadsList />}>
            <Route path=":id" element={<LeadDetailModal />} />
          </Route>

          <Route path="offers" element={<OffersList />} />
          <Route path="offers/new" element={<OfferForm />} />
          <Route path="offers/:id/edit" element={<OfferForm />} />

          <Route path="offer-templates" element={<OfferTemplatesList />} />
          <Route path="offer-templates/new" element={<OfferTemplateForm />} />
          <Route path="offer-templates/:id/edit" element={<OfferTemplateForm />} />

          <Route path="agreements" element={<AgreementsList />} />
          <Route path="agreements/new" element={<AgreementForm />} />
          <Route path="agreements/:offerId/edit" element={<AgreementForm />} />

          <Route path="projects" element={<ProjectsList />} />
          <Route path="projects/new" element={<ProjectForm />} />
          <Route path="projects/:offerId" element={<ProjectDetail />} />
          <Route path="projects/:offerId/edit" element={<ProjectForm />} />

          <Route path="billings" element={<BillingsList />} />
          <Route path="billings/:offerId" element={<BillingsDetail />} />

          <Route path="finance" element={<Finance />} />

          <Route path="clients" element={<ClientsList />} />
          <Route path="clients/new" element={<ClientForm />} />
          <Route path="clients/:id/edit" element={<ClientForm />} />

          <Route path="personnel" element={<PersonnelList />} />
          <Route path="personnel/new" element={<PersonnelForm />} />
          <Route path="personnel/:id/edit" element={<PersonnelForm />} />

          <Route path="users" element={<UsersList />} />
          <Route path="users/new" element={<UserForm />} />
          <Route path="users/:id/edit" element={<UserForm />} />

          <Route path="domains" element={<DomainsList />} />
          <Route path="domains/new" element={<DomainForm />} />
          <Route path="domains/:id/edit" element={<DomainForm />} />

          <Route path="blog" element={<BlogList />} />
          <Route path="blog/new" element={<BlogForm />} />
          <Route path="blog/:id/edit" element={<BlogForm />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
