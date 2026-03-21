import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { adminApi, isApiError, participantApi } from '@/shared/api/client'
import { queryKeys } from '@/shared/contracts/api'

export function isUnauthorized(error: unknown) {
  return isApiError(error) && error.status === 401
}

export function useParticipantSession() {
  return useQuery({
    queryKey: queryKeys.participantSession,
    queryFn: participantApi.me,
    retry: false,
  })
}

export function useAdminSession() {
  return useQuery({
    queryKey: queryKeys.adminSession,
    queryFn: adminApi.me,
    retry: false,
  })
}

export function useParticipantLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await participantApi.logout()
      // invalidateQueries + refetch оставляет старые data при ошибке 401 — кажется, что вход всё ещё активен
      queryClient.removeQueries({ queryKey: queryKeys.participantSession })
      queryClient.removeQueries({ queryKey: ['teams'] })
      queryClient.removeQueries({ queryKey: ['questions'] })
      queryClient.removeQueries({ queryKey: ['enigma'] })
    },
  })
}

export function useAdminLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await adminApi.logout()
      queryClient.removeQueries({ queryKey: queryKeys.adminSession })
      queryClient.removeQueries({ queryKey: ['admin'] })
    },
  })
}
