import { test, expect } from '@playwright/test'
import { utils } from '../helpers'
const cheerio = require('cheerio')
const sep = '-'.repeat(75)
const _ = require('lodash')

test.beforeAll(async () => {
    if (process.env.CI) {
        console.log('Clearing session state...')
        const defaultState = {
            cookies: [],
            origins: [],
        }
        utils.write(defaultState, utils.getStorageStateFile(), true)
    }
})

test('gets answers', async ({ page }, testInfo) => {
    // First, get existing clues
    const existingClues = utils.getWordsInDictionary()
    const existingWords = existingClues.map((item) => item.word)
    // page.goto('https://www.ben-willenbring.com/bee-clues')
    const baseUrl = 'https://www.ben-willenbring.com'
    let hasNextUrl = true
    let url = `${baseUrl}/bee-clues?format=json`
    let ALL_ANSWERS = []
    // Initialize a request object
    const req = await utils.getApiRequestObj()

    // testing
    let i = 0

    while (hasNextUrl === true && i < 10) {
        console.log(`GETTING: ${url}`)
        // Initialize
        let keys, body
        // make the request to the correct URL
        const r = await (await req.get(url)).json()
        // Gather up the posts
        const posts = await r.items
        const p = r.pagination
        // Trap the next url
        hasNextUrl =
            p.nextPageUrl && p.nextPageUrl.includes('bee-clues') ? true : false

        // Conditionally reset the url...
        url = hasNextUrl ? `${baseUrl}${p.nextPageUrl}&format=json` : url

        for (let post of posts) {
            // Get the answers for this post
            const $ = cheerio.load(post.body)
            // trim and clean up the answers
            const answers = $('[data-testid="for-the-cheaters"]')
                .text()
                .split(',')
                .map((i) => i.trim().toLowerCase())
            // Then add them to answers
            const filteredAnswers = answers.filter(
                (word) => !existingWords.includes(word)
            )
            ALL_ANSWERS = ALL_ANSWERS.concat(filteredAnswers)
        }
        console.log(
            `${i + 1}. Processed ${posts.length} posts...\nnexturl: ${
                p.nextPageUrl
            }\n${sep}`
        )
        // Increment i
        i++
    }

    console.log('all answers')
    ALL_ANSWERS = ALL_ANSWERS.sort()
    ALL_ANSWERS = Array.from(new Set(ALL_ANSWERS))
    // Create the new thing
    const new_stuff = ALL_ANSWERS.map((w) => {
        const obj = {
            word: w,
            clue: '',
        }
        return obj
    })

    let all_words = _.union(existingClues, new_stuff)
    // Sort
    all_words = _.sortBy(all_words, [
        function (o) {
            return o.word
        },
    ])
    console.log(all_words)
    console.log(sep)

    // Write the new and expanded local dictionary
    utils.write({ words: all_words }, './local_dictionary/new_words.json', true)
})
