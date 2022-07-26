const { test, expect } = require('@playwright/test')
const shell = require('shelljs')

/**
 *
 * This spec logs into squarespace as Mauk Mulder, then does the following
 *  - Navigates to the One Useless Fact Blog
 *  - Clicks + button to create a new entry
 *  - Stpes through the form
 */

// functions
const sleep = (duration = 1) => shell.exec(`sleep ${duration}`)

// From env vars
const email = process.env.SQ_EMAIL
const password = process.env.SS_PASSWORD
const postTitle = `Playwright Post`
const postBody = `# \`AN\`
1. AN6 — occurring once every year *_synonyms_*—yearly, bimonthly, biweekly, daily, monthly sounds like—manual
AN8 — once a year : each year *_sounds like_*—manually
AN5 — to balance with an equal force so as to make ineffective; to put an end to by formal action *_synonyms_*—cancel (out), compensate (for), correct, counteract, counterbalance *_sounds like_*—addle, agile, apple, channel, null

`

test('basic test', async ({ page }) => {
    // Go to the login page
    await page.goto('https://home-office-employee.squarespace.com/config/pages')

    // Enter credentials
    await page.fill('[type="email"]', email)
    await page.fill('[type="password"]', password)

    // TODO: Remove
    await page.screenshot({
        path: './cypress/fixtures/playwright-login-page-screenshot.png',
        fullPage: true,
    })

    await page.click('[data-test="login-button"]')
    await page.waitForNavigation((opts) => {
        // console.log(opts.url)
    })

    // Leftnav => One Useless Fact (very low on the leftnav of links)
    await page.click(
        '.App-sidebar section[data-test="navlist-not_linked"] [title="One Useless Fact"]'
    )

    // Ensure the page navigation is done
    await page.waitForNavigation()
    // Assert you're no longer on `/config/pages`
    expect(page.url().endsWith('/config/pages')).toBeFalsy()
    // Make sure + btn is visble, then click it
    let plus_btn = page.locator('[data-test="blog-add-item"]')
    await expect(plus_btn).toBeVisible()
    await plus_btn.click()

    // Make sure the blog post form is visible
    let form = page.locator('.squarespace-managed-ui')
    await expect(form).toBeVisible()

    // Enter a title into [data-test="text"]
    await page.fill('input[data-test="text"]', postTitle)

    // Click into the form to bring the body editable
    await page.locator('p[data-rte-preserve-empty="true"]:visible').click()

    // Type into the element for the body
    // await page.locator('div[contenteditable="true"]:visible p')
    // await page.locator('div[contenteditable="true"]:visible').fill(postBody)
    await page.keyboard.type(postBody)

    // Wait 2 seconds
    sleep(2)

    // Save and close
    await page.locator('[data-test="dialog-saveAndClose"]').click()
})
