import { Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import AdminRoute from './components/AdminRoute'
import AdminLayout from './components/admin/AdminLayout'
import AppUpdateNotifier from './components/AppUpdateNotifier'
import { useAuth } from './lib/AuthContext'
import { useOwnAdminRowQuery } from './data/admins'
import { useSiteContentQuery } from './data/siteContent'
import { lazyRetry } from './lib/lazyRetry'

const Maintenance = lazyRetry(() => import('./pages/Maintenance'))

const Home = lazyRetry(() => import('./pages/Home'))
const About = lazyRetry(() => import('./pages/About'))
const Excos = lazyRetry(() => import('./pages/Excos'))
const Contact = lazyRetry(() => import('./pages/Contact'))
const NotFound = lazyRetry(() => import('./pages/NotFound'))
const Outlines = lazyRetry(() => import('./pages/Outlines'))
const Curriculum = lazyRetry(() => import('./pages/Curriculum'))
const OutlineLevel = lazyRetry(() => import('./pages/outlines/OutlineLevel'))
const OutlineCourses = lazyRetry(() => import('./pages/outlines/OutlineCourses'))
const OutlineDetail = lazyRetry(() => import('./pages/outlines/OutlineDetail'))
const Timetable = lazyRetry(() => import('./pages/Timetable'))
const TimetableLevel = lazyRetry(() => import('./pages/timetable/TimetableLevel'))
const Events = lazyRetry(() => import('./pages/Events'))
const EventDetail = lazyRetry(() => import('./pages/EventDetail'))
const Resources = lazyRetry(() => import('./pages/Resources'))
const ResourceLevel = lazyRetry(() => import('./pages/resources/ResourceLevel'))
const ResourceList = lazyRetry(() => import('./pages/resources/ResourceList'))
const News = lazyRetry(() => import('./pages/News'))
const NewsDetail = lazyRetry(() => import('./pages/NewsDetail'))
const Opportunities = lazyRetry(() => import('./pages/Opportunities'))
const Quizzes = lazyRetry(() => import('./pages/Quizzes'))
const Awards = lazyRetry(() => import('./pages/Awards'))
const Forms = lazyRetry(() => import('./pages/Forms'))
const FormDetail = lazyRetry(() => import('./pages/FormDetail'))
const Cgpa = lazyRetry(() => import('./pages/Cgpa'))
const Login = lazyRetry(() => import('./pages/Login'))
const Account = lazyRetry(() => import('./pages/Account'))
const Signup = lazyRetry(() => import('./pages/Signup'))
const ForgotPassword = lazyRetry(() => import('./pages/ForgotPassword'))
const ResetPassword = lazyRetry(() => import('./pages/ResetPassword'))
const Admin = lazyRetry(() => import('./pages/Admin'))
const AdminNews = lazyRetry(() => import('./pages/admin/AdminNews'))
const AdminHandbook = lazyRetry(() => import('./pages/admin/AdminHandbook'))
const AdminOpportunities = lazyRetry(() => import('./pages/admin/AdminOpportunities'))
const AdminEvents = lazyRetry(() => import('./pages/admin/AdminEvents'))
const AdminEventGallery = lazyRetry(() => import('./pages/admin/AdminEventGallery'))
const AdminHomeContent = lazyRetry(() => import('./pages/admin/AdminHomeContent'))
const AdminSiteLinks = lazyRetry(() => import('./pages/admin/AdminSiteLinks'))
const AdminPageBanners = lazyRetry(() => import('./pages/admin/AdminPageBanners'))
const AdminResources = lazyRetry(() => import('./pages/admin/AdminResources'))
const AdminExcos = lazyRetry(() => import('./pages/admin/AdminExcos'))
const AdminUsers = lazyRetry(() => import('./pages/admin/AdminUsers'))
const AdminMessages = lazyRetry(() => import('./pages/admin/AdminMessages'))
const AdminSystem = lazyRetry(() => import('./pages/admin/AdminSystem'))
const AdminSecurity = lazyRetry(() => import('./pages/admin/AdminSecurity'))
const AdminReviews = lazyRetry(() => import('./pages/admin/AdminReviews'))
const AdminBroadcasts = lazyRetry(() => import('./pages/admin/AdminBroadcasts'))
const AdminEmailTemplates = lazyRetry(() => import('./pages/admin/AdminEmailTemplates'))
const AdminOutlines = lazyRetry(() => import('./pages/admin/AdminOutlines'))
const AdminSubmissions = lazyRetry(() => import('./pages/admin/AdminSubmissions'))
const AdminTimetables = lazyRetry(() => import('./pages/admin/AdminTimetables'))
const AdminForms = lazyRetry(() => import('./pages/admin/AdminForms'))
const AdminFormEditor = lazyRetry(() => import('./pages/admin/AdminFormEditor'))
const AdminFormResponses = lazyRetry(() => import('./pages/admin/AdminFormResponses'))
const AdminAwards = lazyRetry(() => import('./pages/admin/AdminAwards'))
const AdminAwardSeason = lazyRetry(() => import('./pages/admin/AdminAwardSeason'))
const AdminAwardCurate = lazyRetry(() => import('./pages/admin/AdminAwardCurate'))
const AdminAwardResults = lazyRetry(() => import('./pages/admin/AdminAwardResults'))
const AdminQuizzes = lazyRetry(() => import('./pages/admin/AdminQuizzes'))
const AdminQuizEditor = lazyRetry(() => import('./pages/admin/AdminQuizEditor'))
const AdminQuizStudio = lazyRetry(() => import('./pages/admin/AdminQuizStudio'))
const AdminQuizReport = lazyRetry(() => import('./pages/admin/AdminQuizReport'))
const AdminBattles = lazyRetry(() => import('./pages/admin/AdminBattles'))
const HostQuiz = lazyRetry(() => import('./pages/HostQuiz'))
const PlayQuiz = lazyRetry(() => import('./pages/PlayQuiz'))
const PlayPractice = lazyRetry(() => import('./pages/PlayPractice'))
const PlayBattle = lazyRetry(() => import('./pages/PlayBattle'))
const PracticeList = lazyRetry(() => import('./pages/PracticeList'))
const MakeQuiz = lazyRetry(() => import('./pages/MakeQuiz'))
const CustomSet = lazyRetry(() => import('./pages/CustomSet'))

function MaintenanceGate({ children }) {
  const location = useLocation()
  const { user } = useAuth()
  const siteContentQuery = useSiteContentQuery()
  const adminRowQuery = useOwnAdminRowQuery(user?.id)

  const isMaintenanceOn = Boolean(siteContentQuery.data?.maintenance_mode)
  const isAdmin = Boolean(adminRowQuery.data)
  const isLoginPage = location.pathname === '/login'

  if (isMaintenanceOn && !isAdmin && !isLoginPage) {
    return (
      <Suspense fallback={null}>
        <Maintenance />
      </Suspense>
    )
  }

  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppUpdateNotifier />
      <MaintenanceGate>
        <Routes>
          <Route
            path="maintenance"
            element={
              <Suspense fallback={null}>
                <Maintenance />
              </Suspense>
            }
          />
          {/* Full-screen quiz pages: no site header or footer, so they suit a projector and a phone. */}
          <Route
            path="play"
            element={
              <Suspense fallback={null}>
                <PlayQuiz />
              </Suspense>
            }
          />
          {['battle', 'battle/:code'].map((path) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense fallback={null}>
                  <PlayBattle />
                </Suspense>
              }
            />
          ))}
          <Route
            path="make"
            element={
              <Suspense fallback={null}>
                <MakeQuiz />
              </Suspense>
            }
          />
          <Route
            path="set/:code"
            element={
              <Suspense fallback={null}>
                <CustomSet />
              </Suspense>
            }
          />
          <Route
            path="practice"
            element={
              <Suspense fallback={null}>
                <PracticeList />
              </Suspense>
            }
          />
          <Route
            path="practice/:quizId"
            element={
              <Suspense fallback={null}>
                <PlayPractice />
              </Suspense>
            }
          />
          <Route element={<AdminRoute />}>
            <Route
              path="host/:sessionId"
              element={
                <Suspense fallback={null}>
                  <HostQuiz />
                </Suspense>
              }
            />
          </Route>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="excos" element={<Excos />} />
            <Route path="contact" element={<Contact />} />
            <Route path="outlines" element={<Outlines />} />
            <Route path="curriculum" element={<Curriculum />} />
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
            <Route path="quiz" element={<Quizzes />} />
            <Route path="forms" element={<Forms />} />
            <Route path="forms/:id" element={<FormDetail />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="account" element={<Account />} />
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<Admin />} />
              <Route element={<AdminLayout />}>
                <Route path="admin/home" element={<AdminHomeContent />} />
                <Route path="admin/links" element={<AdminSiteLinks />} />
                <Route path="admin/banners" element={<AdminPageBanners />} />
                <Route path="admin/news" element={<AdminNews />} />
                <Route path="admin/handbook" element={<AdminHandbook />} />
                <Route path="admin/opportunities" element={<AdminOpportunities />} />
                <Route path="admin/events" element={<AdminEvents />} />
                <Route path="admin/events/:id/gallery" element={<AdminEventGallery />} />
                <Route path="admin/resources" element={<AdminResources />} />
                <Route path="admin/excos" element={<AdminExcos />} />
                <Route path="admin/users" element={<AdminUsers />} />
                <Route path="admin/messages" element={<AdminMessages />} />
                <Route path="admin/system" element={<AdminSystem />} />
                <Route path="admin/security" element={<AdminSecurity />} />
                <Route path="admin/reviews" element={<AdminReviews />} />
                <Route path="admin/broadcasts" element={<AdminBroadcasts />} />
                <Route path="admin/email-templates" element={<AdminEmailTemplates />} />
                <Route path="admin/outlines" element={<AdminOutlines />} />
                <Route path="admin/submissions" element={<AdminSubmissions />} />
                <Route path="admin/timetables" element={<AdminTimetables />} />
                <Route path="admin/forms" element={<AdminForms />} />
                <Route path="admin/forms/new" element={<AdminFormEditor />} />
                <Route path="admin/forms/:id/edit" element={<AdminFormEditor />} />
                <Route path="admin/forms/:id/responses" element={<AdminFormResponses />} />
                <Route path="admin/quizzes" element={<AdminQuizzes />} />
                <Route path="admin/quizzes/new" element={<AdminQuizEditor />} />
                <Route path="admin/quizzes/:id/edit" element={<AdminQuizEditor />} />
                <Route path="admin/quizzes/:id/studio" element={<AdminQuizStudio />} />
                <Route path="admin/quizzes/games/:sessionId" element={<AdminQuizReport />} />
                <Route path="admin/quizzes/battles" element={<AdminBattles />} />
                <Route path="admin/awards" element={<AdminAwards />} />
                <Route path="admin/awards/new" element={<AdminAwardSeason />} />
                <Route path="admin/awards/:seasonId/edit" element={<AdminAwardSeason />} />
                <Route path="admin/awards/:seasonId/categories/:categoryId/curate" element={<AdminAwardCurate />} />
                <Route path="admin/awards/:seasonId/results" element={<AdminAwardResults />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </MaintenanceGate>
    </ErrorBoundary>
  )
}
