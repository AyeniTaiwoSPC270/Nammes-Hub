import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import AdminRoute from './components/AdminRoute'

const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Excos = lazy(() => import('./pages/Excos'))
const Contact = lazy(() => import('./pages/Contact'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Outlines = lazy(() => import('./pages/Outlines'))
const OutlineLevel = lazy(() => import('./pages/outlines/OutlineLevel'))
const OutlineCourses = lazy(() => import('./pages/outlines/OutlineCourses'))
const OutlineDetail = lazy(() => import('./pages/outlines/OutlineDetail'))
const Timetable = lazy(() => import('./pages/Timetable'))
const TimetableLevel = lazy(() => import('./pages/timetable/TimetableLevel'))
const Events = lazy(() => import('./pages/Events'))
const EventDetail = lazy(() => import('./pages/EventDetail'))
const Resources = lazy(() => import('./pages/Resources'))
const ResourceLevel = lazy(() => import('./pages/resources/ResourceLevel'))
const ResourceList = lazy(() => import('./pages/resources/ResourceList'))
const News = lazy(() => import('./pages/News'))
const NewsDetail = lazy(() => import('./pages/NewsDetail'))
const Opportunities = lazy(() => import('./pages/Opportunities'))
const Awards = lazy(() => import('./pages/Awards'))
const Forms = lazy(() => import('./pages/Forms'))
const FormDetail = lazy(() => import('./pages/FormDetail'))
const Cgpa = lazy(() => import('./pages/Cgpa'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Admin = lazy(() => import('./pages/Admin'))
const AdminNews = lazy(() => import('./pages/admin/AdminNews'))
const AdminOpportunities = lazy(() => import('./pages/admin/AdminOpportunities'))
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'))
const AdminEventGallery = lazy(() => import('./pages/admin/AdminEventGallery'))
const AdminResources = lazy(() => import('./pages/admin/AdminResources'))
const AdminExcos = lazy(() => import('./pages/admin/AdminExcos'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'))
const AdminOutlines = lazy(() => import('./pages/admin/AdminOutlines'))
const AdminSubmissions = lazy(() => import('./pages/admin/AdminSubmissions'))
const AdminTimetables = lazy(() => import('./pages/admin/AdminTimetables'))
const AdminForms = lazy(() => import('./pages/admin/AdminForms'))
const AdminFormEditor = lazy(() => import('./pages/admin/AdminFormEditor'))
const AdminFormResponses = lazy(() => import('./pages/admin/AdminFormResponses'))
const AdminAwards = lazy(() => import('./pages/admin/AdminAwards'))
const AdminAwardSeason = lazy(() => import('./pages/admin/AdminAwardSeason'))
const AdminAwardCurate = lazy(() => import('./pages/admin/AdminAwardCurate'))
const AdminAwardResults = lazy(() => import('./pages/admin/AdminAwardResults'))

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="excos" element={<Excos />} />
          <Route path="contact" element={<Contact />} />
          <Route path="outlines" element={<Outlines />} />
          <Route path="outlines/:level" element={<OutlineLevel />} />
          <Route path="outlines/:level/:semester" element={<OutlineCourses />} />
          <Route path="outlines/:level/:semester/:code" element={<OutlineDetail />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="timetable/:level" element={<TimetableLevel />} />
          <Route path="cgpa" element={<Cgpa />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="resources" element={<Resources />} />
          <Route path="resources/:level" element={<ResourceLevel />} />
          <Route path="resources/:level/:semester" element={<ResourceList />} />
          <Route path="news" element={<News />} />
          <Route path="news/:id" element={<NewsDetail />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="awards" element={<Awards />} />
          <Route path="forms" element={<Forms />} />
          <Route path="forms/:id" element={<FormDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<Admin />} />
            <Route path="admin/news" element={<AdminNews />} />
            <Route path="admin/opportunities" element={<AdminOpportunities />} />
            <Route path="admin/events" element={<AdminEvents />} />
            <Route path="admin/events/:id/gallery" element={<AdminEventGallery />} />
            <Route path="admin/resources" element={<AdminResources />} />
            <Route path="admin/excos" element={<AdminExcos />} />
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/reviews" element={<AdminReviews />} />
            <Route path="admin/outlines" element={<AdminOutlines />} />
            <Route path="admin/submissions" element={<AdminSubmissions />} />
            <Route path="admin/timetables" element={<AdminTimetables />} />
            <Route path="admin/forms" element={<AdminForms />} />
            <Route path="admin/forms/new" element={<AdminFormEditor />} />
            <Route path="admin/forms/:id/edit" element={<AdminFormEditor />} />
            <Route path="admin/forms/:id/responses" element={<AdminFormResponses />} />
            <Route path="admin/awards" element={<AdminAwards />} />
            <Route path="admin/awards/new" element={<AdminAwardSeason />} />
            <Route path="admin/awards/:seasonId/edit" element={<AdminAwardSeason />} />
            <Route path="admin/awards/:seasonId/categories/:categoryId/curate" element={<AdminAwardCurate />} />
            <Route path="admin/awards/:seasonId/results" element={<AdminAwardResults />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
