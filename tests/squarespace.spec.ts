import { test, expect, Locator, chromium } from '@playwright/test'
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

test.use({
    storageState: {},
    headless: false,
})

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
    await chromium.launch({ headless: false, slowMo: 750 })
    console.log('Setting default test timeout to 120000 ms')
    test.setTimeout(120000)

    // Set a long timeout var that will be used in various places
    const longTimeout = 60000

    // To slow things down to a crawl
    // await utils.slowDown({
    //     factor: 5,
    //     page: page,
    // })

    const postTitle = utils.getPostTitle()
    const clues = await utils.getCluesAsJson(page)
    const postBody = await utils.getPostBody(clues)
    const postExcerpt = await utils.getPostExcerpt(clues)

    console.log(`✅ postTitle:\n${postTitle}`)
    console.log(sep)
    console.log('✅ Write files')
    // TODO: FIX ME
    const filePath = './fixtures/clues'
    utils.write(postBody, `${filePath}.html`, false)
    utils.write(clues, `${filePath}.json`, true)
    console.log(`\t- Wrote 2 files to ./fixtures...`)

    // Login
    console.log(`Logging in...`)
    await utils.loginToSquarespace(page, squarespaceCredentials, testInfo)
    console.log(`\t- Logged in, waiting to navigate to 🐝 Clues...`)
    utils.sleep(2)

    // Navigate to NYTimes 🐝 Clues
    const blogURL =
        'https://home-office-employee.squarespace.com/config/pages/62e1297259707700d7654d86'
    await page.goto(blogURL, {
        waitUntil: 'domcontentloaded',
    })
    console.log(`\t- In the blog section...`)
    utils.sleep(1)

    // Make sure + btn is visble, then click it
    console.log('Trying to add blog post now...')
    let plus_btn = await page.locator('[data-test="blog-add-item"]')
    // Explicityly set a 60sec timeout on this
    await expect(plus_btn).toBeVisible({ timeout: longTimeout })
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
    await page
        .locator('#block-selector-button-markdown')
        .click({ timeout: longTimeout, force: true })
    console.log('\t- Just clicked Markdown menu item...')
    utils.sleep(1)

    // Paste in the html AS MARKDOWN + comments
    // Note: Do not use .type() here, it is too slow
    await page
        .locator(`.CodeMirror textarea`)
        .fill(postBody, { timeout: longTimeout, force: true })
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
        .click({ timeout: longTimeout, force: true })
    console.log('\t- Just clicked Apply...')

    // Let's print the response — note: the triple await is necessary
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
    await page.locator('[data-tab]:text("Options")').click()
    utils.sleep(1)

    // Wait for this selector to be visible
    console.log(`\t- Checking for visibility of options input...`)
    await expect(
        await page.locator('[data-test="text"][name="urlId"]')
    ).toBeDefined()
    console.log(`\t- Configurable options exist...`)

    // Scroll down to excerpt
    console.log('Setting excerpt...')

    const excerptWrapper = await page
        .locator('[data-testvalue="excerpt"] [data-test="wrapper"]')
        .locator('div')
        .first()

    console.log('\t- Just clicked into the excerpt placeholder...')
    utils.sleep(1)

    // Type excerpt
    await excerptWrapper.click({ force: true })
    utils.sleep(0.5)
    await excerptWrapper.type(postExcerpt)
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
