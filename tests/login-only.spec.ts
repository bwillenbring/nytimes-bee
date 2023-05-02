import { test, expect, Locator } from '@playwright/test'
import { utils } from '../helpers'

// From env vars
const squarespaceCredentials = {
    email: process.env.SQ_EMAIL,
    password: process.env.SS_PASSWORD,
}

test.use({
    storageState: {},
    baseURL: 'https://home-office-employee.squarespace.com',
})

test.beforeEach(async ({ page }) => {
    const blogURL = '/config/pages/62e1297259707700d7654d86'
    await page.goto(blogURL, {
        waitUntil: 'domcontentloaded',
    })
})

test('logs in', async ({ page }, testInfo) => {
    // Because networking on github runners is 💩
    test.slow()
    console.log('Setting default test timeout to 120000 ms')
    test.setTimeout(120000)

    // Slow down connection
    // await utils.slowDown({
    //     factor: 5,
    //     page: page,
    // })

    utils.sleep(2)
    await utils.loginToSquarespace(page, squarespaceCredentials, testInfo)
    utils.sleep(2)
})
