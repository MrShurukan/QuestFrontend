import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AdminShell, NotFoundPage, PlayerShell, PublicShell, RootLayout } from '@/app/layouts'
import {
  AdminAuditPage,
  AdminDashboardPage,
  AdminEnigmaPage,
  AdminPoolsPage,
  AdminQrPage,
  AdminQuestDayPage,
  AdminQuestionsPage,
  AdminRoutingPage,
  AdminSettingsPage,
  AdminSupportTeamDetailsPage,
  AdminSupportTeamsPage,
  AdminTagsPage,
} from '@/features/admin/admin-pages'
import { PlayerEnigmaPage, PlayerProfilePage, PlayerQuestionDetailsPage, PlayerQuestionsPage, PlayerTeamPage } from '@/features/player/player-pages'
import { AdminLoginPage, LandingPage, PlayerLoginPage, QrRoutePage, QuestStatusPage } from '@/features/public/public-pages'
import { RequireAdmin, RequireParticipant } from '@/features/session/session'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        element: <PublicShell />,
        children: [
          { index: true, element: <LandingPage /> },
          { path: 'player/login', element: <PlayerLoginPage /> },
          { path: 'admin/login', element: <AdminLoginPage /> },
          { path: 'q/:slug', element: <QrRoutePage /> },
          { path: 'quest-status', element: <QuestStatusPage /> },
        ],
      },
      {
        path: 'player',
        element: <RequireParticipant />,
        children: [
          {
            element: <PlayerShell />,
            children: [
              { index: true, element: <Navigate replace to="/player/team" /> },
              { path: 'team', element: <PlayerTeamPage /> },
              { path: 'questions', element: <PlayerQuestionsPage /> },
              { path: 'questions/:questionId', element: <PlayerQuestionDetailsPage /> },
              { path: 'enigma', element: <PlayerEnigmaPage /> },
              { path: 'profile', element: <PlayerProfilePage /> },
            ],
          },
        ],
      },
      {
        path: 'admin',
        element: <RequireAdmin />,
        children: [
          {
            element: <AdminShell />,
            children: [
              { index: true, element: <AdminDashboardPage /> },
              { path: 'tags', element: <AdminTagsPage /> },
              { path: 'questions', element: <AdminQuestionsPage /> },
              { path: 'pools', element: <AdminPoolsPage /> },
              { path: 'qr', element: <AdminQrPage /> },
              { path: 'routing', element: <AdminRoutingPage /> },
              { path: 'enigma', element: <AdminEnigmaPage /> },
              { path: 'quest-day', element: <AdminQuestDayPage /> },
              { path: 'settings', element: <AdminSettingsPage /> },
              { path: 'support/teams', element: <AdminSupportTeamsPage /> },
              { path: 'support/teams/:teamId', element: <AdminSupportTeamDetailsPage /> },
              { path: 'audit', element: <AdminAuditPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
