import { test, expect } from '@playwright/test'
import { utils } from '../helpers'
const sep = '-'.repeat(75)

/**
 *
 * This spec logs into squarespace as Mauk Mulder, then does the following
 *  - Navigates to the NYT 🐝 Clues
 *  - Clicks + button to create a new post
 *  - Steps through the form, and pastes html into the markdown input
 */

// From env vars
const squarespaceCredentials = {
    email: process.env.SQ_EMAIL,
    password: process.env.SS_PASSWORD,
}

test.beforeAll(async () => {
    if (process.env.CI) {
        console.log('Clearing session state...')
        const defaultState = {
            cookies: [],
            origins: [],
        }
        utils.write(defaultState, utils.getStorageStateFile(), true)

        // Print build info
        console.log(`Branch: ${process.env.GITHUB_REF_NAME}`)
        console.log(`Actor: ${process.env.GITHUB_ACTOR}`)
        console.log(`Run Attempt: ${process.env.GITHUB_RUN_ATTEMPT}`)
        console.log(`Run ID: ${process.env.GITHUB_RUN_ID}`)
    }
})

test('posts nytimes bee clues to squarespace', async ({ page }, testInfo) => {
    // Because networking on github runners is 💩
    test.slow()

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

    // console.log(`✅ postBody:\n${postBody}`)
    // console.log(sep)

    console.log(`✅ clues:\n${JSON.stringify(clues, undefined, 2)}`)
    console.log(sep)

    console.log('✅ Write files')
    // utils.write('sample', './000.txt', false) // Works
    // TODO: FIX ME
    const filePath1 = './fixtures/clues.html'
    const filePath2 = filePath1.replace('.html', '.json')
    utils.write(postBody, filePath1, false)
    utils.write(clues, filePath2, true)
    console.log(`\t- Wrote 2 files to ./fixtures...`)

    // Login
    console.log(`Logging in...`)
    await utils.loginToSquarespace(page, squarespaceCredentials)
    console.log(`\t- Logged in, waiting to navigate to 🐝 Clues...`)
    utils.sleep(2)

    // Navigate to NYTimes 🐝 Clues
    // await utils.selectLeftNavItem(page, 'NYTimes 🐝 Clues')
    const blogURL =
        'https://home-office-employee.squarespace.com/config/pages/62e1297259707700d7654d86'
    await page.goto(blogURL, {
        waitUntil: 'domcontentloaded',
    })
    console.log(`\t- In the blog section...`)
    utils.sleep(1)

    // Make sure + btn is visble, then click it
    console.log('Trying to add blog post now...')
    let plus_btn = await page.locator('[data-test="blog-add-item"]:visible')
    await expect(plus_btn).toBeVisible()
    console.log('The + btn became visible... clicking it now...')
    const newPost = page.waitForRequest(`**/text-posts**`)
    await plus_btn.click({ force: true })
    console.log(
        `☠️ Wait for the text-posts xhr to return — could take a while!`
    )
    const r = await newPost

    // Make sure the blog post form is visible
    await expect(await page.locator('.squarespace-managed-ui')).toBeVisible()

    // Enter a title into [data-test="text"]
    console.log('Setting title...')
    await page
        .locator('.squarespace-managed-ui input[data-test="text"]:visible')
        .type(postTitle)
    utils.sleep(1)

    // --------------------------------------------------
    // Insert a block of Markdown at the top point
    console.log('Adding html as markdown...')
    const mdSel = '[data-test="insert-point-trigger"]'
    await page.locator(mdSel).first().click({ force: true })
    console.log('\t- Just clicked point trigger...')
    utils.sleep(1)

    // Choose the Markdown menu item
    await page.locator('#block-selector-button-markdown').click({ force: true })
    console.log('\t- Just clicked Markdown menu item...')
    utils.sleep(1)

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

    // Wait for this selector to be visible
    console.log(`\t- Checking for visibility of options input...`)
    await expect(
        await page.locator('[data-test="text"][name="urlId"]:visible')
    ).toBeVisible()
    console.log(`\t- Configurable options are visible...`)

    // Scroll down to excerpt
    console.log('Setting excerpt...')
    // NOTE: This scrollIntoViewIfneeded() is very problematic because of...
    // locator.scrollIntoViewIfNeeded: Element is not attached to the DOM
    // await page
    //     .locator('[data-testvalue="excerpt"] p.rte-placeholder')
    //     .scrollIntoViewIfNeeded()
    await page
        .locator('[data-testvalue="excerpt"] p.rte-placeholder')
        .click({ force: true })
    console.log('\t- Just clicked into the excerpt placeholder...')
    utils.sleep(1)

    // Type excerpt
    // await page
    //     .locator('[data-testvalue="excerpt"] [contenteditable="true"]')
    //     .type(postExcerpt)
    await page
        .locator('[data-testvalue="excerpt"] [contenteditable="true"]')
        .type(postExcerpt)
    console.log('\t- Just typed the excerpt...')
    utils.sleep(1)

    // Save and close || publish
    console.log('Saving...')
    // By default save a draft only
    let saveBtnSelector = '[data-test="dialog-saveAndClose"]'
    const branch = process.env.GITHUB_REF_NAME || ''
    // Only publish if the branch is main
    if (process.env.CI && branch === 'main') {
        // Save and Publish
        saveBtnSelector = saveBtnSelector.replace('Close', 'Publish')
    }
    // Commit all changes
    await page.locator(saveBtnSelector).click({ force: true })

    console.log('❤️ almost done...')
    utils.sleep(3)
    console.log('❤️ done...')
})
