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
    mutationFn: participantApi.logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.participantSession })
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
      await queryClient.invalidateQueries({ queryKey: ['questions'] })
      await queryClient.invalidateQueries({ queryKey: ['enigma'] })
    },
  })
}

export function useAdminLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: adminApi.logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSession })
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}
