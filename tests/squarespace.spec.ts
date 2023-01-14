const { test, expect, Page } = require('@playwright/test')
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
const squarespaceCredentials = {
    email: email,
    password: password,
}

// test.use({})

test('posts nytimes bee clues to squarespace', async ({ page }, testInfo) => {
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

    console.log('✅ DO NOT write files')
    // const filePath1 = 'clues.html'
    // const filePath2 = filePath1.replace('.html', '.json')

    // try {
    //     utils.write(postBody, filePath1)
    //     utils.write(JSON.stringify(clues, undefined, 2), filePath2)
    // } catch (err: any) {
    //     console.log('Could not write files')
    //     console.log(err.message)
    // }

    // Login
    await utils.loginToSquarespace(page, squarespaceCredentials)

    // Navigate to NYTimes 🐝 Clues
    await utils.selectLeftNavItem(page, 'NYTimes 🐝 Clues')

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

    // Set the Options tab
    console.log('Setting options...')
    await page.locator('[data-tab]', { hasText: 'Options' }).click()

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
