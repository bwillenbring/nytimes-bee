const { test, expect } = require('@playwright/test')
const shell = require('shelljs')
const dayjs = require('dayjs')
const fs = require('fs')
const sep = '-'.repeat(75)

/**
 *
 * This spec logs into squarespace as Mauk Mulder, then does the following
 *  - Navigates to the NYT 🐝 Clues
 *  - Clicks + button to create a new post
 *  - Steps through the form, and pastes html into the markdown input
 */

// functions
const sleep = (duration = 1) => shell.exec(`sleep ${duration}`)
const read = (file_path, json = false) =>
    json
        ? JSON.parse(fs.readFileSync(file_path))
        : fs.readFileSync(file_path, { encoding: 'utf8' })

// From env vars
const email = process.env.SQ_EMAIL
const password = process.env.SS_PASSWORD

// Timestamp for post creation (eg: Tue. 26 July, 2022)
const now = dayjs()
const dayString = now.format('dddd')

// read gameData as json
const gd = read('cypress/fixtures/gameData.json', true)
let words = gd.today.answers
words.sort()
let validLetters = `\`${gd.today.centerLetter}\`  ${gd.today.outerLetters.join(
    '  '
)}`
let excerpt = `## Letters: ${validLetters}
- Total Answers: ${gd.today.answers.length}
Pangrams: ${gd.today.pangrams.length}
Words revealed in these clues: None! 🤣`

let commentedAnswers = `<div data-testid="for-the-cheaters" style="display:none !important;">${words.join(
    ', '
)}</div>`

// title and subtitle
const postTitle = `NYT 🐝 Clues—${now.format('ddd. D MMMM, YYYY')}`
const postBody = read('./cypress/fixtures/clues.html') + '\n' + commentedAnswers

test('basic test', async ({ page }) => {
    // Go to the login page
    await page.goto('https://home-office-employee.squarespace.com/config/pages')

    // Enter credentials
    await page.fill('[type="email"]', email)
    await page.fill('[type="password"]', password)

    // TODO: Remove when things stabilize
    await page.screenshot({
        path: './cypress/fixtures/playwright-login-page-screenshot.png',
        fullPage: true,
    })

    // Click Login
    await page.click('[data-test="login-button"]')
    let opts = {
        waitUntil: 'domcontentloaded',
    }
    // Ensure document is loaded
    await page.waitForNavigation(opts)
    sleep(1)

    // Navigate to Leftnav => NYTimes 🐝 Clues (very low on the leftnav of links)
    const leftNavTitle = `NYTimes 🐝 Clues`
    await page.click(
        `.App-sidebar section[data-test="navlist-not_linked"] [title="${leftNavTitle}"]`
    )

    // Ensure the page navigation is done
    opts.url = /config\/pages\//
    await page.waitForNavigation(opts)
    sleep(1)

    // Make sure + btn is visble, then click it
    let plus_btn = await page.locator('[data-test="blog-add-item"]')
    expect(plus_btn).toBeVisible()
    await plus_btn.click()

    // Make sure the blog post form is visible
    let form = await page.locator('.squarespace-managed-ui')
    expect(form).toBeVisible()

    // Enter a title into [data-test="text"]
    await page.fill('input[data-test="text"]', postTitle)

    // --------------------------------------------------
    // Insert a block of Markdown at the top point
    await page.locator('.insert-point-icon').first().click({ force: true })
    await page.locator('#block-selector-button-markdown').click()

    // Paste in the html AS MARKDOWN + comments
    await page.locator('.CodeMirror textarea').fill(postBody)
    sleep(1)

    // Apply changes
    await page
        .locator('[data-test="dialog-saveAndClose"][value="Apply"]')
        .click()
    sleep(1)

    // Set tags and hit enter
    await page
        .locator('.text.dialog-element', {
            hasText: 'Click to add tags',
        })
        .click()
    await page.fill('input[placeholder="Tags, comma separated"]', 'bee')
    await page.keyboard.press('Enter')
    sleep(1)

    // Set comments
    await page
        .locator('.field-workflow-wrapper', { hasText: 'Comments Off' })
        .click()
    await page
        .locator('.field-workflow-flyout-option', {
            hasText: 'Comments On',
        })
        .click()
    sleep(1)

    // Set the Options tab
    await page.locator('[data-tab]', { hasText: 'Options' }).click()
    sleep(1)

    // Scroll down to excerpt
    await page
        .locator('[data-testvalue="excerpt"] p.rte-placeholder')
        .scrollIntoViewIfNeeded()
    await page.locator('[data-testvalue="excerpt"] p.rte-placeholder').click()
    sleep(1)

    // Type excerpt
    await page
        .locator('[data-testvalue="excerpt"] [contenteditable="true"]')
        .type(excerpt)
    sleep(1)

    // Save and close || publish
    // To publish: '[data-test="dialog-saveAndPublish"]'
    await page
        .locator('[data-test="dialog-saveAndClose"]')
        .click({ force: true })
    sleep(1)
})
