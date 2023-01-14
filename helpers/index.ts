import { Page, request, APIRequestContext } from '@playwright/test'

const shell = require('shelljs')
const dayjs = require('dayjs')
const fs = require('fs')
const path = require('path')
const rita = require('rita')
import { flatten } from 'lodash'

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

// URLs & Keys for Thesaurus & Dictionary endpoints
const urlT = process.env.API_URL_T || ''
const urlD = process.env.API_URL_D || ''
const keyT = process.env.API_KEY_T || ''
const keyD = process.env.API_KEY_D || ''

const getApiRequestObj = async () => {
    const req: APIRequestContext = await request.newContext()
    return req
}

const getSynonyms = async (word) => {
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
    const url2 = `${urlD}/${word}?key=${keyD}`
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

// Function that returns a header
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
    return fs.existsSync(file_path)
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

    // Sort

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
    const url = 'https://nytimes.com/puzzles/spelling-bee'
    await page.goto(url)
    const gd: Clues = await page.evaluate(`window.gameData`)
    return gd
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
        `## Letters: ${validLetters}`,
        `- Total Answers: ${gd.today.answers.length}`,
        `Pangrams: ${gd.today.pangrams.length}`,
        `Words revealed in these clues: None! 🤣`,
    ]

    return excerpt.join('\n')
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
    getCluesAsJson,
    getPostBody,
    getPostExcerpt,
    getPostTitle,
    getSynonyms,
    read,
    sleep,
    write,
}

export { utils }