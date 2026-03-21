import { expect, test } from '@playwright/test'

test('landing page is reachable', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Quest Enigma' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Quest Enigma' })).toBeVisible()
})

test('player login screen opens', async ({ page }) => {
  await page.goto('/player/login')

  await expect(page.getByRole('heading', { name: 'Участник' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Регистрация' })).toBeVisible()
})
