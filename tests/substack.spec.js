const { test, expect } = require('@playwright/test')
const fs = require('fs')
const shell = require('shelljs')
const dayjs = require('dayjs')

/**
 *
 * Important Notes
 *
 */

const sleep = (duration = 1) => shell.exec(`sleep ${duration}`)

const read = (file_path, json = false) =>
    json
        ? JSON.parse(fs.readFileSync(file_path))
        : fs.readFileSync(file_path, { encoding: 'utf8' })

// From env vars
const email = process.env.SQ_EMAIL || 'foo'
const password = process.env.SQ_PASSWORD || 'foo'

// For post creation
// timestamp (eg: Tue. 26 July, 2022)
const now = dayjs()
const dayString = now.format('dddd')

// title and subtitle
const postTitle = `NYT 🐝 Clues—${now.format('ddd. D MMMM, YYYY')}`
const postSubtitle = `Clues for ${dayString}'s New York Times Spelling Bee`
// TODO: Ensure postBody comes from clues.html
// const postBody = read('./cypress/fixtures/clues.html')
const postBody = '<p>Testing</p>'

test('basic test', async ({ page }) => {
    // Go to the login page for substack
    await page.goto(
        'https://substack.com/sign-in?redirect=%2F&for_pub=jeuxdemots'
    )

    // Enter credentials
    let sel = 'input[type="password"]:visible'
    await page.fill('[type="email"]', email)
    let pi = await page.$(sel)

    if (!pi) {
        // The password input is not visible
        console.log(`☠️ ${sel} NOT visible`)
        // Click the show password link
        await page.locator('a.login-option').click()
        await page.locator(sel).click()
    } else {
        // There is a password input visible
        console.log(`❤️ ${sel} IS visible`)
    }
    // Now enter password
    await page.fill(sel, password)

    // Sign in
    await page.locator('button', { hasText: 'Sign in' }).click()
    // Wait for navigation
    let opts = {
        url: /jeuxdemots\.substack\.com/,
        waitUntil: 'domcontentloaded',
    }
    await page.waitForNavigation((opts) => {
        return console.log('done!')
    })

    // Navigate to dashboard (with options)
    delete opts.url
    // Go directly to new post creation
    await page.goto(
        'https://jeuxdemots.substack.com/publish/post?type=newsletter',
        opts
    )
    // create the post
    let [title, subtitle] = ['Playwright post', 'test subtitle']
    await page.fill(`#post-title`, postTitle)
    await page.fill(`textarea.subtitle`, postSubtitle)

    // Example js
    // const data = { text: 'some data', value: 1 }
    // // Pass |data| as a parameter.
    // const result = await page.evaluate((data) => {
    //     window.myApp.use(data)
    // }, data)

    // My js
    await page.evaluate((postBody) => {
        let ed = document.querySelector('[data-testid="editor"]')
        ed.innerHTML = postBody
        return true
    }, postBody)
    sleep(4)

    // // Leftnav => One Useless Fact (very low on the leftnav of links)
    // await page.click(
    //     '.App-sidebar section[data-test="navlist-not_linked"] [title="One Useless Fact"]'
    // )

    // // Ensure the page navigation is done
    // await page.waitForNavigation()
    // // Assert you're no longer on `/config/pages`
    // expect(page.url().endsWith('/config/pages')).toBeFalsy()
    // // Make sure + btn is visble, then click it
    // let plus_btn = page.locator('[data-test="blog-add-item"]')
    // await expect(plus_btn).toBeVisible()
    // await plus_btn.click()

    // // Make sure the blog post form is visible
    // let form = page.locator('.squarespace-managed-ui')
    // await expect(form).toBeVisible()

    // // Enter a title into [data-test="text"]
    // await page.fill('input[data-test="text"]', postTitle)

    // // Click into the form to bring the body editable
    // await page.locator('p[data-rte-preserve-empty="true"]:visible').click()

    // // Type into the element for the body
    // // await page.locator('div[contenteditable="true"]:visible p')
    // // await page.locator('div[contenteditable="true"]:visible').fill(postBody)
    // await page.keyboard.type(postBody)

    // // Wait 2 seconds
    // sleep(2)

    // // Save and close
    // await page.locator('[data-test="dialog-saveAndClose"]').click()
})
