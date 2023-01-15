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

    // const postTitle = `Testing ${Date.now()}`
    // const clues = { testing: true }
    // const postBody =
    //     'Another test — Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus tincidunt tortor ac rutrum efficitur. Duis a condimentum ex. Aenean ac gravida erat. Nulla tristique, est eu hendrerit luctus, diam urna hendrerit ante, id maximus elit urna sit amet eros. Suspendisse vitae purus leo. Donec id tempor ligula, sed vestibulum tortor. Etiam sapien libero, rutrum eget tincidunt eu, malesuada venenatis sapien. Proin quis ipsum vitae metus egestas placerat. Pellentesque in turpis euismod, finibus dolor vitae, placerat nibh. Pellentesque at aliquet turpis, non varius nulla.'
    // const postExcerpt = `Wow\nyou are fast`

    console.log(`✅ postTitle:\n${postTitle}`)
    console.log(sep)

    console.log(`✅ postBody:\n${postBody}`)
    console.log(sep)

    console.log(`✅ clues:\n${JSON.stringify(clues, undefined, 2)}`)
    console.log(sep)

    console.log('✅ Write file test')
    utils.write('sample', './000.txt', false)
    // TODO: FIX ME
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
    // await utils.selectLeftNavItem(page, 'NYTimes 🐝 Clues')
    const blogURL =
        'https://home-office-employee.squarespace.com/config/pages/62e1297259707700d7654d86'
    await page.goto(blogURL)
    utils.sleep(1)

    // Make sure + btn is visble, then click it
    console.log('Adding blog post now...')
    let plus_btn = await page.locator('[data-test="blog-add-item"]')
    // await expect(plus_btn).toBeVisible()
    await plus_btn.click({ force: true })

    // Make sure the blog post form is visible
    let form = await page.locator('.squarespace-managed-ui')
    // await expect(form).toBeVisible()

    // Enter a title into [data-test="text"]
    console.log('Setting title...')
    let input = await form.locator('input[data-test="text"]:visible')
    await input.type(postTitle)

    // --------------------------------------------------
    // Insert a block of Markdown at the top point
    console.log('Adding html as markdown...')

    await page
        .locator('[data-test="insert-point-trigger"]')
        .first()
        .click({ force: true })
    console.log('\t- Just clicked point trigger...')

    utils.sleep(1)
    // Choose the Markdown menu item
    await page.locator('#block-selector-button-markdown').click({ force: true })
    console.log('\t- Just clicked Markdown menu item...')

    // Paste in the html AS MARKDOWN + comments
    // Note: Do not use .type() here, it is too slow
    // Fill in the textarea
    await page.locator(`.CodeMirror textarea`).fill(postBody, { force: true })
    console.log('\t- Just filled the textarea...')

    // Set up request listener before clicking into markdown editor
    let evt = page.waitForRequest(
        'https://home-office-employee.squarespace.com/api/events/RecordEvent'
    )
    utils.sleep(1)

    // Click Apply changes
    console.log('Applying changes...')
    await page
        .locator('[data-test="dialog-saveAndClose"][value="Apply"]:visible')
        .click({ force: true })
    console.log('\t- Just clicked Apply...')

    // Let's print the response...
    const resp = await (await (await evt).response()).json()
    console.log(resp)
    utils.sleep(1)

    // Set tags and hit enter (no xhr)
    console.log('Setting tags...')
    await page
        .locator('.text.dialog-element', {
            hasText: 'Click to add tags',
        })
        .click()
    await page.fill('input[placeholder="Tags, comma separated"]', 'bee')
    await page.keyboard.press('Enter')
    utils.sleep(1)

    // Set comments ON
    console.log('Setting comments...')
    await page
        .locator('.field-workflow-wrapper', { hasText: 'Comments Off' })
        .click({ force: true })
    utils.sleep(1)

    await page
        .locator('.field-workflow-flyout-option', {
            hasText: 'Comments On',
        })
        .click()
    utils.sleep(1)
    console.log('\t- Just set comments to ON...')

    // Set the Options tab
    console.log('Setting options...')
    // await page.locator('[data-tab]', { hasText: 'Options' }).click()
    await page.locator('[data-tab]:text("Options")').click()
    utils.sleep(1)

    // Scroll down to excerpt
    console.log('Setting excerpt...')
    // await page
    //     .locator('[data-testvalue="excerpt"] p.rte-placeholder')
    //     .scrollIntoViewIfNeeded()
    await page
        .locator('[data-testvalue="excerpt"] p.rte-placeholder')
        .click({ force: true })
    console.log('\t- Just clicked into the excerpt placeholder...')
    utils.sleep(1)

    // Type excerpt
    await page
        .locator('[data-testvalue="excerpt"] [contenteditable="true"]')
        .type(postExcerpt)
    console.log('\t- Just typed the excerpt...')
    utils.sleep(1)

    // Save and close || publish
    console.log('Saving...')
    const evtFinal = page.waitForRequest(
        'https://home-office-employee.squarespace.com/api/events/RecordEvent'
    )

    // To save a draft: '[data-test="dialog-saveAndClose"]'
    await page.locator('[data-test="dialog-saveAndClose"]').click()
    // await page
    //     .locator('[data-test="dialog-saveAndPublish"]')
    //     .click({ force: true })

    const respFinal = await (await (await evtFinal).response()).json()
    console.log(respFinal)
    // utils.sleep(5)
    console.log('❤️	done')
})
