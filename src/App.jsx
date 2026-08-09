import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Outlines from './pages/Outlines'
import OutlineLevel from './pages/outlines/OutlineLevel'
import OutlineCourses from './pages/outlines/OutlineCourses'
import OutlineDetail from './pages/outlines/OutlineDetail'
import Events from './pages/Events'
import Resources from './pages/Resources'
import ResourceLevel from './pages/resources/ResourceLevel'
import ResourceList from './pages/resources/ResourceList'
import News from './pages/News'
import NewsDetail from './pages/NewsDetail'
import Opportunities from './pages/Opportunities'
import Cgpa from './pages/Cgpa'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import AdminNews from './pages/admin/AdminNews'
import AdminOpportunities from './pages/admin/AdminOpportunities'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="outlines" element={<Outlines />} />
        <Route path="outlines/:level" element={<OutlineLevel />} />
        <Route path="outlines/:level/:semester" element={<OutlineCourses />} />
        <Route path="outlines/:level/:semester/:code" element={<OutlineDetail />} />
        <Route path="cgpa" element={<Cgpa />} />
        <Route path="events" element={<Events />} />
        <Route path="resources" element={<Resources />} />
        <Route path="resources/:level" element={<ResourceLevel />} />
        <Route path="resources/:level/:semester" element={<ResourceList />} />
        <Route path="news" element={<News />} />
        <Route path="news/:id" element={<NewsDetail />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route path="admin" element={<Admin />} />
          <Route path="admin/news" element={<AdminNews />} />
          <Route path="admin/opportunities" element={<AdminOpportunities />} />
        </Route>
      </Route>
    </Routes>
  )
}
