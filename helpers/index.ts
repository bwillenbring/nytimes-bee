import { Page, request, APIRequestContext, expect } from '@playwright/test'
import { stat } from 'fs'

const shell = require('shelljs')
const dayjs = require('dayjs')
const fs = require('fs')
const path = require('path')
const rita = require('rita')
import { flatten } from 'lodash'
const config = require('../playwright.config')

// Types
type Answers = {
    answers?: Array<string>
    centerLetter?: string
    displayDate?: string
    displayWeekday?: string
    editor?: string
    id?: number
    outerLetters?: Array<string>
    pangrams?: Array<string>
    printDate?: Date
    validLetters?: Array<string>
}

type Clues = {
    today?: Answers
    yesterday?: Answers
}

type LoginCredentials = {
    email?: string
    username?: string
    password: string
}

type DictionaryClue = {
    word: string
    clue?: string
}

// URLs & Keys for Thesaurus & Dictionary endpoints
const urlT = process.env.API_URL_T || ''
const urlD = process.env.API_URL_D || ''
const keyT = process.env.API_KEY_T || ''
const keyD = process.env.API_KEY_D || ''

/**
 * Gets an api request context, and sets its storage state file to the same as the one used in playwright.config.ts
 * @returns {APIRequestContext}
 */
const getApiRequestObj = async () => {
    const f = await getStorageStateFile()
    console.log(f)
    const req: APIRequestContext = await request.newContext({
        storageState: f,
    })
    return req
}

/**
 * Does two things:
 *   1. Consults the configured storage state file
 *   2. If it doesn't exist, it creates an empty one {}
 * @returns {string}
 */
const getStorageStateFile = () => {
    const f = config.use.storageState
    const file_path = path.join(__dirname, `../${f}`)
    if (!fileExists(file_path)) {
        // create it
        const emptyStorage = {
            cookies: [],
            origins: [],
        }
        // write(emptyStorage, file_path, true);
    }
    return file_path
}

const getSynonyms = async (word: string) => {
    // Reject
    if (word.length < 4) {
        throw new Error('word must be 4 or more characters long.')
    }
    // First, load all words with definitions / clues
    const dictionary = getWordsWithClues()
    const match = dictionary.find(
        (item) => item.word.toLowerCase() === word.toLowerCase() && item.clue
    )
    if (match) {
        return {
            defs: [match.clue],
            syns: [],
        }
    } else {
        // Consult the Merriam Webster API
        return await getAPISynonyms(word)
    }
}

const getWordsInDictionary = (): DictionaryClue[] => {
    const dictFile = './local_dictionary/words.json'
    try {
        let words = read(dictFile, true).words
        words = words.filter((word) => word.word && word.word.length >= 4)
        return words
    } catch (err) {
        return []
    }
}

/**
 * Reads in a local dictionary file and returns an array of type DictionaryClue where each  item in the array has a non-null word and clue with this structure:
 * - `word`
 * - `clue`
 * @returns {Array}
 */
const getWordsWithClues = (): DictionaryClue[] => {
    // get all words
    const allWords = getWordsInDictionary()
    try {
        const words = allWords.filter(
            (word) => word.clue && word.clue.length > 4
        )
        return words
    } catch (err) {
        return []
    }
}

/**
 *
 * @param word {string}
 * @returns
 */
const getAPISynonyms = async (word) => {
    // Always consult the thesaurus first
    let url = `${urlT}/${word}?key=${keyT}`

    const req = await getApiRequestObj()

    // definitions
    const r1 = await (await req.get(url)).json()
    const defs = r1
        .filter(
            (item) =>
                item.hasOwnProperty('shortdef') && item.shortdef.length > 0
        )
        .map((entries) => flatten(entries.shortdef))

    // synonyms
    // const url2 = `${urlD}/${word}?key=${keyD}`
    // const r2 = await (await req.get(url2)).json()
    const syns = r1
        .filter((item) => item.meta && item.meta.syns)
        .map((entries) => flatten(entries.meta.syns))

    return {
        defs: flatten(defs).splice(0, 3),
        syns: flatten(syns).splice(0, 5),
    }
}

// Functions
/**
 * @function mask
 * @description Turns `this` into `t***`
 *
 */
const mask = (word) => '*'.repeat(word.length)

/**
 * @function firstNChars
 * @description Takes a string and returns the first n chars of that string
 *
 */
const firstNChars = (word: string, n: number = 1) => {
    // If n makes no sense, or ther word makes no sense
    if (word && word.length && n >= word.length) {
        return word
    } else {
        try {
            return word.split('').slice(0, n).join('')
        } catch {
            return word
        }
    }
}

/**
 * @function partialMask
 * @description Takes a string like `florida` and returns `f******`
 *
 */
const partialMask = (word: string) => {
    let firstChar = word.charAt(0)
    return mask(word).replace('*', firstChar)
}

const obfuscateDefinition = (def: any, word: string) => {
    if (!def || !Array.isArray(def)) {
        return []
    }
    const r = eval(`/${word}/gi`)
    const repl = mask(word)
    // let new_defs = def.map((d) => d.replace(r, repl))
    const new_defs = def.map((d) => d.replace(r, repl).replace(/^—/, ''))
    return new_defs
}

/**
 * Builds a string of `formatted HTML`. Portions of this html RESEMBLE the {@link getPostExcerpt} function, but don't rely on it. {@link formatHeader} produces similar but different versions of an excerpt.
 * @param clues {Object}
 * @returns {string} The fragment of html that appears at the top of each blog post: `<tagline> <typewriter image> <puzzle breakdown>`
 */
const formatHeader = (clues: Clues) => {
    // Sort out the letters
    let requiredLetter = clues.today.centerLetter
    let letters = clues.today.validLetters
    // Generate this... m  e  g  i  h  i  n  t
    let formatedLetters = letters
        .map((l) => {
            // Italicize the required letter
            if (l === requiredLetter) {
                return `<i>${l}</i>`
            } else {
                return l
            }
        })
        .join('&nbsp;&nbsp;')

    // 1. Add the tagline
    let tagline = `<p>Clues for the <a href="https://www.nytimes.com/puzzles/spelling-bee" target="_blank">New York Times Spelling Bee</a> are generated daily by <a href="https://ben-willenbring.com/about">Ben Willenbring</a> from his home in Brooklyn.</p><img src="https://images.squarespace-cdn.com/content/v1/5dabaee11e9d9809a8816556/1604540401455-POGIZF5QUKC77HZZ2GO9/typing-animated-gif-letterbox.gif?format=1500w"/>`

    // 2. title... Letters: m  e  g  i  h  i  n  t
    let title = `${tagline}<h1>Letters:  ${formatedLetters}</h1>`

    // 3. answers + pangrams
    let totalAnswers = `<li>Total Answers: ${clues.today.answers.length}</li>`
    let pangrams = `<li>Pangrams: ${clues.today.pangrams.length}</li>`
    let wordsRevealed = `<li>Words revealed in these clues: None! 🤣</li>`
    let bullets = `<ul>${totalAnswers}${pangrams}${wordsRevealed}</ul>`
    // 4. Wrap it up with... title + bullets + hr
    return `${title}${bullets}<hr/>`
}

const generateSoundsLikeWords = (word) => {
    // Geneate an array of sounds-like words using rita
    let soundsLike = rita.soundsLike(word)
    // Get the 1st two chars of the word
    const w_first_two = firstNChars(word, 2)
    // Filter out sounds-like words whose 1st two chars == 1st two chars of the word
    soundsLike = soundsLike.filter(
        (w) => w.charAt(0) + w.charAt(1) !== w_first_two
    )
    // Only include up to 5 sounds-like words
    soundsLike = soundsLike.splice(0, 5)
    // Obfuscate each sounds-like word that might contain the word itself
    soundsLike = obfuscateDefinition(soundsLike, word)
    // Return this array
    return soundsLike
}

const getGroupings = (words: string[]) => {
    const groupings = words.map((word) => firstNChars(word, 2))
    return Array.from(new Set(groupings))
}

const fileExists = (file_path: string) => {
    try {
        return fs.existsSync(file_path)
    } catch (err) {
        return false
    }
}

const login = (username: string, password: string) => {
    // login to squarespace
}

const fixPath = (file_path: string) => {
    return path.join(__dirname, file_path)
}

const getPostTitle = () => {
    // Timestamp for post creation (eg: Tue. 26 July, 2022)
    const now = dayjs()
    const dayString = now.format('dddd')
    return `NYT 🐝 Clues—${now.format('ddd. D MMMM, YYYY')}`
}

const getPostBody = async (clues) => {
    // First, get the header
    const header = formatHeader(clues)

    /** Return clues as a string of html, formatted like this...
     * <h2><code>AB</code></h2>
        <ol start="1">
            <li>
                <b>AB4</b> — to be adjacent to <b><i>synonyms</i></b
                >—adjoin, border (on), butt (on or against), flank, fringe
                <b><i>sounds like</i></b
                >—but, butt
            </li>
        </ol>
     */
    // Sort the words
    const words = clues.today.answers
    words.sort()

    const SYNS = {}

    for (let word of words) {
        SYNS[word] = await getSynonyms(word)
    }
    // Get the groupings
    const grps = getGroupings(words)
    // Iterate over each 2 letter code
    const HTML = []
    let wordsAdded = 0
    for (let grp of grps) {
        let idx = grps.indexOf(grp) + 1 + wordsAdded
        const grpWords = words.filter((word) => word.startsWith(grp))
        const wordHtml = grpWords
            .map((w) => {
                wordsAdded++
                const firstTwo = firstNChars(w, 2)
                // get defs and syns
                const ds = SYNS[w]
                const defs = ds.defs
                const syns = [...ds.defs, ...ds.syns].splice(0, 5)

                // definition of word
                const def =
                    syns.length && syns.length > 0 ? `${syns.join('; ')} ` : ''

                // soundslike word(s)
                const slw = generateSoundsLikeWords(w)
                const soundsLike =
                    slw.length && slw.length > 0
                        ? `<b><i>sounds like</i></b> ${slw.join(', ')}`
                        : ''

                // Build the html for this 1 word
                let html = `<li><b>${firstTwo.toUpperCase()}${
                    w.length
                }</b> — ${def}${soundsLike}</li>`

                // Return the html fragment
                return html
            })
            .join('\n')
        const html =
            `<h2><code>${grp.toUpperCase()}</code></h2>` +
            `<ol start="${idx}">${wordHtml}</ol>`
        HTML.push(html)
    }

    // Append the actual answers in a hidden div
    const commentedAnswers = `<div data-testid="for-the-cheaters" style="display:none !important;">${words.join(
        ', '
    )}</div>`

    // Add the hidden answers
    HTML.push(commentedAnswers)

    // Return the html
    return header + '\n' + HTML.join('\n\n')
}

const getCluesAsJson = async (page: Page) => {
    const clueFile = './fixtures/clues.json'
    // First see if the file exists locally
    if (fileExists(clueFile)) {
        console.log(`\t- ❤️ Clues already exist!`)
        const gd: Clues = read(clueFile, true)
        return gd
    } else {
        const url = 'https://nytimes.com/puzzles/spelling-bee'
        await page.goto(url)
        const gd: Clues = await page.evaluate(`window.gameData`)
        // Write this
        console.log(`Now writing clue file to ${clueFile}`)
        write(gd, clueFile, true)
        return gd
    }
}

const getPostExcerpt = async (gameData) => {
    // Get the json
    const gd: Clues = JSON.parse(JSON.stringify(gameData))

    // These are the words for today's bee — we'll sort them
    const words = gd.today.answers.sort()

    // From env vars
    const email = process.env.SQ_EMAIL
    const password = process.env.SS_PASSWORD

    // Timestamp for post creation (eg: Tue. 26 July, 2022)
    const now = dayjs()
    const dayString = now.format('dddd')

    const cl = `\`${gd.today.centerLetter}\``
    const ol = gd.today.outerLetters.join('  ')

    let validLetters = `${cl}  ${ol}`
    // Note: the 2nd and 3rd bullets will automatically be converted when the enter key is used. There's no need for a hypehn
    let excerpt = [
        `Letters: ${validLetters}`,
        `- Total Answers: ${gd.today.answers.length}`,
        `Pangrams: ${gd.today.pangrams.length}`,
        `Words revealed in these clues: None! 🤣`,
    ]

    return excerpt.join('\n')
}

const loginToSquarespace = async (
    page: Page,
    credentials: LoginCredentials
) => {
    // First, read the storageState file
    const f = getStorageStateFile()
    console.log(`Storage state file — ${f} exists... ${fileExists(f)}\n${f}`)
    const state = read(f, true)
    // Go to the login page
    await page.goto('https://home-office-employee.squarespace.com/config/pages')
    if (state.cookies.length > 0) {
        // already logged in
        console.log(`\t-❤️ Already logged in!!\n${'-'.repeat(50)}`)
    } else {
        console.log('\t-😢 Not logged in...')
        // Enter credentials
        await page.fill('[type="email"]', credentials.email)
        await page.fill('[type="password"]', credentials.password)

        console.log('logging into Squarespace, but awaiting 2 things...')
        // Set up an xhr
        const req = page.waitForResponse('**/api/*/login/user**', {
            timeout: 45000,
        })
        // Await 2 things: click to login + the xhr arising from the click
        const responses = await Promise.all([
            req,
            page.click('[data-test="login-button"]', { timeout: 45000 }),
        ])
        // Log
        console.log(
            '\t-Just clicked login, waiting for xhr to respond w 200...'
        )
        // Assert that the xhr responds with 200 status code
        const r = await responses[0]
        await expect(await r.status()).toEqual(200)
        console.log(`\t- 👍🏽 xhr statusCode is 200`)
        console.log(
            `\t- Waiting for ui to render [data-test="appshell-container"]`
        )
    }

    // --------------------------------------------------
    console.log('👇🏽 One final UI assertion!')
    // Make ui assertion with generous timeout
    await expect(
        await page.locator('[data-test="appshell-container"]')
    ).toBeVisible({ timeout: 45000 })
    console.log(`\t- 👍🏽 URL is now ${page.url()}`)
    console.log(`\t- Persisting storageState`)
    await persistStorageState(page)
    console.log(`\t- ✅ Good to go\n${'-'.repeat(50)}`)
    utils.sleep(1)
}

/**
 * Does
 * @param page {Page} the page object
 * @returns
 */
const persistStorageState = async (page: Page) => {
    const f = await getStorageStateFile()
    // Persist the storage state
    await page.context().storageState({ path: f })
    return
}

const read = (file_path: string, json = true) => {
    // Ensure the file exists
    if (!fileExists(file_path)) {
        // throw new Error(`File does not exist: ${file_path}`);
        return json ? {} : ''
    }
    // Otherwise,
    return json
        ? JSON.parse(fs.readFileSync(file_path))
        : fs.readFileSync(file_path, { encoding: 'utf8' })
}

const selectLeftNavItem = async (page: Page, leftNavTitle: string) => {
    console.log(`Navigating to ${leftNavTitle}...`)

    // 1. Form the selector we will click on in the leftnav
    const selector = `.App-sidebar section[data-test="navlist-not_linked"] [title="${leftNavTitle}"]`

    // 2. Scroll to it
    // await page.locator(selector).scrollIntoViewIfNeeded()

    // 3. Set up a request listener
    const xhr = page.waitForRequest(
        'https://home-office-employee.squarespace.com/api/popup-overlay/**'
    )

    // 4. Click it
    await page.locator(selector).click({ force: true })

    // 5. ☝🏽 triggers page nav (which doesn't always change the url)
    // We'll wait for the xhr request's response, then print it
    const resp = await (await (await xhr).response()).json()
    console.log(`Response after navigating to ${leftNavTitle}...`)
    console.log(`{ shouldDisplayOnPage: ${resp.shouldDisplayOnPage} }`)
    utils.sleep(2)
}

const sleep = (duration: number = 1) => shell.exec(`sleep ${duration}`)

const write = (
    text: string | Object,
    file_path: string,
    as_json: boolean = false
) =>
    !as_json
        ? fs.writeFileSync(file_path, text)
        : fs.writeFileSync(file_path, JSON.stringify(text, undefined, 2))

const utils = {
    fixPath,
    getApiRequestObj,
    getAPISynonyms,
    getCluesAsJson,
    getPostBody,
    getPostExcerpt,
    getPostTitle,
    getStorageStateFile,
    getSynonyms,
    getWordsInDictionary,
    getWordsWithClues,
    loginToSquarespace,
    read,
    selectLeftNavItem,
    sleep,
    write,
}

export { utils }
