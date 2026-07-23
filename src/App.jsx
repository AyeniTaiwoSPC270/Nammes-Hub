import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Outlines from './pages/Outlines'
import OutlineLevel from './pages/outlines/OutlineLevel'
import OutlineCourses from './pages/outlines/OutlineCourses'
import OutlineDetail from './pages/outlines/OutlineDetail'
import Events from './pages/Events'
import Resources from './pages/Resources'
import News from './pages/News'
import NewsDetail from './pages/NewsDetail'
import Opportunities from './pages/Opportunities'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="outlines" element={<Outlines />} />
        <Route path="outlines/:level" element={<OutlineLevel />} />
        <Route path="outlines/:level/:semester" element={<OutlineCourses />} />
        <Route path="outlines/:level/:semester/:code" element={<OutlineDetail />} />
        <Route path="events" element={<Events />} />
        <Route path="resources" element={<Resources />} />
        <Route path="news" element={<News />} />
        <Route path="news/:id" element={<NewsDetail />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  )
}
