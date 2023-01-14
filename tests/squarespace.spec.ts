const { test, expect } = require('@playwright/test')
const shell = require('shelljs')
const dayjs = require('dayjs')
const fs = require('fs')
const sep = '-'.repeat(75)

import { utils } from '../helpers'

/**
 *
 * This spec logs into squarespace as Mauk Mulder, then does the following
 *  - Navigates to the NYT 🐝 Clues
 *  - Clicks + button to create a new post
 *  - Steps through the form, and pastes html into the markdown input
 */

// From env vars
const email = process.env.SQ_EMAIL
const password = process.env.SS_PASSWORD

// test.use({})

test.only('basic test 00', async ({ page }, testInfo) => {
    const postTitle = utils.getPostTitle()
    const clues = await utils.getCluesAsJson(page)
    const postBody = await utils.getPostBody(clues)
    const postExcerpt = await utils.getPostExcerpt(clues)

    console.log(`✅ postTitle:\n${postTitle}`)
    console.log(sep)

    console.log(`✅ postBody:\n${postBody}`)
    console.log(sep)

    console.log(`✅ clues:\n${JSON.stringify(clues, undefined, 2)}`)
    console.log(sep)

    console.log('✅ Writing files to cypress/fixtures/')
    const filePath1 = 'cypress/fixtures/clues.html'
    utils.write(postBody, filePath1)

    const filePath2 = 'cypress/fixtures/clues.json'
    utils.write(JSON.stringify(clues, undefined, 2), filePath2)

    // Go to the login page
    await page.goto('https://home-office-employee.squarespace.com/config/pages')

    // Enter credentials
    await page.fill('[type="email"]', email)
    await page.fill('[type="password"]', password)

    // TODO: Remove when things stabilize
    await testInfo.attach('Squarespace Login', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })

    console.log('logging into Squarespace...')

    // Click Login
    await Promise.all([
        page.click('[data-test="login-button"]'),
        page.waitForNavigation(),
    ])

    utils.sleep(1)

    console.log('Navigating to NYTimes 🐝 Clues...')
    // Navigate to Leftnav => NYTimes 🐝 Clues (very low on the leftnav of links)
    const leftNavTitle = `NYTimes 🐝 Clues`
    await page.click(
        `.App-sidebar section[data-test="navlist-not_linked"] [title="${leftNavTitle}"]`
    )

    // Ensure the page navigation is done
    await page.waitForNavigation({
        url: /config\/pages\//,
    })
    utils.sleep(1)

    // Make sure + btn is visble, then click it
    console.log('Adding blog post now...')
    let plus_btn = await page.locator('[data-test="blog-add-item"]')
    await expect(plus_btn).toBeVisible()
    await plus_btn.click()

    // Make sure the blog post form is visible
    let form = await page.locator('.squarespace-managed-ui')
    await expect(form).toBeVisible()

    // Enter a title into [data-test="text"]
    console.log('Setting title...')
    await page.fill('input[data-test="text"]', postTitle)

    // --------------------------------------------------
    // Insert a block of Markdown at the top point
    console.log('Adding html as markdown...')
    await page.locator('.insert-point-icon').first().click({ force: true })
    await page.locator('#block-selector-button-markdown').click()

    // Paste in the html AS MARKDOWN + comments
    await page.locator('.CodeMirror textarea').fill(postBody)
    utils.sleep(1)

    // Apply changes
    console.log('Applying changes...')
    await page
        .locator('[data-test="dialog-saveAndClose"][value="Apply"]')
        .click()
    utils.sleep(1)

    // Set tags and hit enter
    console.log('Setting tags...')
    await page
        .locator('.text.dialog-element', {
            hasText: 'Click to add tags',
        })
        .click()
    await page.fill('input[placeholder="Tags, comma separated"]', 'bee')
    await page.keyboard.press('Enter')
    utils.sleep(1)

    // Set comments
    console.log('Setting comments...')
    await page
        .locator('.field-workflow-wrapper', { hasText: 'Comments Off' })
        .click()
    await page
        .locator('.field-workflow-flyout-option', {
            hasText: 'Comments On',
        })
        .click()
    // sleep(1)

    // Set the Options tab
    await page.locator('[data-tab]', { hasText: 'Options' }).click()
    // sleep(1)

    // Scroll down to excerpt
    console.log('Setting excerpt...')
    await page
        .locator('[data-testvalue="excerpt"] p.rte-placeholder')
        .scrollIntoViewIfNeeded()
    await page.locator('[data-testvalue="excerpt"] p.rte-placeholder').click()
    utils.sleep(1)

    // Type excerpt
    await page
        .locator('[data-testvalue="excerpt"] [contenteditable="true"]')
        .type(postExcerpt)
    utils.sleep(1)

    // Save and close || publish
    console.log('Saving...')
    // To save a draft: '[data-test="dialog-saveAndClose"]'
    await page.locator('[data-test="dialog-saveAndClose"]').click()
    // await page
    //     .locator('[data-test="dialog-saveAndPublish"]')
    //     .click({ force: true })
    utils.sleep(1)
    console.log('❤️	done')
})
