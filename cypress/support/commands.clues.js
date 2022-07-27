// We need rita for synonym generation and such
const rita = require('rita')

// URLs & Keys for Thesaurus & Dictionary endpoints
const urlT = Cypress.env('API_URL_T')
const urlD = Cypress.env('API_URL_D')
const keyT = Cypress.env('API_KEY_T')
const keyD = Cypress.env('API_KEY_D')

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
const firstNChars = (word = null, n = 1) => {
    // If n makes no sense, or ther word makes no sense
    if (n < 1 || !word || !word.length || typeof word !== 'string') {
        return word
    }
    // If n exceeds the word...
    else if (word.length && n >= word.length) {
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
const partialMask = (word) => {
    let firstChar = word.charAt(0)
    return mask(word).replace('*', firstChar)
}

const obfuscateDefinition = (def, word) => {
    if (!def || !Array.isArray(def)) {
        return []
    }
    let r = eval(`/${word}/gi`)
    let repl = mask(word)
    // let new_defs = def.map((d) => d.replace(r, repl))
    let new_defs = def.map((d) => d.replace(r, repl).replace(/^—/, ''))
    return new_defs
}

const generateSoundsLikeWords = (word) => {
    // Geneate an array of sounds-like words using rita
    let soundsLike = rita.soundsLike(word)
    // Get the 1st two chars of the word
    let w_first_two = word.charAt(0) + word.charAt(1)
    // Filter out sounds-like words whose 1st two chars == 1st two chars of the word
    soundsLike = soundsLike.filter(
        (w) => w.charAt(0) + w.charAt(1) !== w_first_two
    )
    // Only include up to 5 sounds-like words
    soundsLike = soundsLike.slice(0, 5)
    // Obfuscate each sounds-like word that might contain the word itself
    soundsLike = obfuscateDefinition(soundsLike, word)
    // Return this array
    return soundsLike
}

const getClues = (arr, word, thesaurus = true) => {
    if (!arr || !Array.isArray(arr) || arr.length < 1) {
        // Immediate throw error if arr is wrong type
        console.log(JSON.stringify(arr, undefined, 2))
        throw new Error('Argument must be an array of at least 1 item')
        return
    }
    // This indicates that the dictionary endpoint should be used
    if (thesaurus === false) {
        let isVerb = Cypress._.find(arr, (o) => o.fl === 'verb')
        let [shortdef, syns] = [[], []]

        // Get the entry from the dictionary api's response,
        // with a bias for verbs, then for non-verbs with long definitions
        let entry = isVerb
            ? isVerb
            : Cypress._.sortBy(arr, (o) => o.shortdef).shift()

        // Get the short definition from the entry
        shortdef =
            Array.isArray(entry.shortdef) && entry.shortdef.length > 1
                ? Cypress._.flatten(entry.shortdef)
                : entry.shortdef
        // Obfuscate the short definition, in case it mentions the word
        shortdef = obfuscateDefinition(shortdef, word)
        // Generate an array of sounds-like words
        let soundsLike = generateSoundsLikeWords(word)
        // Short definition + up to 5 soundsLike words
        return {
            word: word,
            shortdef: shortdef,
            soundsLike: soundsLike,
        }
    }
    // If arr is a valid array that contains synonyms
    else if (
        Array.isArray(arr) &&
        arr.length > 0 &&
        arr[0].shortdef &&
        Cypress._.has(arr[0], 'meta.syns')
    ) {
        // Get the short definitiion
        let shortdef = arr[0].shortdef ? Cypress._.flatten(arr[0].shortdef) : []
        // Obfuscate
        shortdef = obfuscateDefinition(shortdef, word)
        // Generate an array of sounds-like words
        let soundsLike = generateSoundsLikeWords(word)
        // Get synonyms from the api response
        let syns = Cypress._.flatten(arr[0].meta.syns) || []
        // Limit the synonyms to 5
        syns = syns.slice(0, 5)

        // Short definition + synonyms
        return {
            word: word,
            shortdef: shortdef,
            soundsLike: soundsLike,
            syns: syns,
        }
    } else {
        return null
    }
}

// Function that returns a header
const formatHeader = (gameData) => {
    // Sort out the letters
    let requiredLetter = gameData.today.centerLetter
    let letters = gameData.today.validLetters
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
    let tagline = `<p>Clues are generated daily by <a href="https://ben-willenbring.com">Ben Willenbring</a> from his home in Brooklyn.</p><img src="https://images.squarespace-cdn.com/content/v1/5dabaee11e9d9809a8816556/1604540401455-POGIZF5QUKC77HZZ2GO9/typing-animated-gif-letterbox.gif?format=1500w"/>`

    // 2. title... Letters: m  e  g  i  h  i  n  t
    let title = `${tagline}<h1>Letters:  ${formatedLetters}</h1>`

    // 3. answers + pangrams
    let totalAnswers = `<li>Total Answers: ${gameData.today.answers.length}</li>`
    let pangrams = `<li>Pangrams: ${gameData.today.pangrams.length}</li>`
    let wordsRevealed = `<li>Words revealed in these clues: None! 🤣</li>`
    let bullets = `<ul>${totalAnswers}${pangrams}${wordsRevealed}</ul>`
    // 4. Wrap it up with... title + bullets + hr
    return `${title}${bullets}<hr/>`
}

const formatClues = (clues) => {
    // We'll assume clues are sorted by word
    // initialize HTML
    let HTML = ''
    // Get array of 2-letter groupings, like...: ac, ah, am, an, ca, ch, ci, ea...
    let groupings = clues.map((clue) => firstNChars(clue.word, 2))
    groupings = Array.from(new Set(groupings))

    // Iterate over groupings
    let counter = 1
    for (let grp of groupings) {
        HTML += `<h2><code>${grp.toUpperCase()}</code></h2>`
        // Also include all words within this grouping
        let clues_within_grp = clues.filter(
            (clue) => firstNChars(clue.word, 2) === grp
        )
        let words_within_grp = clues_within_grp.map((clue) => {
            // Definition
            let shortdef = obfuscateDefinition(clue.shortdef, clue.word)
            let displaydef =
                shortdef && shortdef.length ? `${shortdef.join('; ')}` : ''
            // Synonyms
            let syns = obfuscateDefinition(clue.syns, clue.word)
            let displaysyns =
                syns && syns.length > 0
                    ? `<b><i>synonyms</i></b>—${syns.join(', ')}`
                    : ''
            // Sounds-like words
            let soundsLike = obfuscateDefinition(clue.soundsLike, clue.word)
            let displaysoundsLike =
                soundsLike && soundsLike.length
                    ? `<b><i>sounds like</i></b>—${soundsLike.join(', ')}`
                    : ''

            // Each item should be this...
            // AC4 :: <shorted> :: <syns> :: <soundsLike>
            return (
                `<li><b>${grp.toUpperCase()}${clue.word.length}</b> — ` +
                `${displaydef} ${displaysyns} ${displaysoundsLike}</li>`
            )
        })

        HTML += `<ol start="${counter}">${words_within_grp.join('\n')}</ol>`
        // Increment counter
        counter += words_within_grp.length
    }
    return HTML
}

Cypress.Commands.add('getClues', (word) => {
    // Always consult the thesaurus first
    let url = `${urlT}/${word}?key=${keyT}`
    let clues
    cy.request(url)
        .its('body')
        .then((r) => {
            console.log(JSON.stringify(r, undefined, 2))
            clues = getClues(r, word)
        })
        .then(() => {
            // Let's consult the dictionary, not the thesaurus
            if (!clues) {
                url = `${urlD}/${word}?key=${keyD}`
                cy.request(url)
                    .its('body')
                    .then((r) => {
                        clues = getClues(r, word, false)
                    })
            }
        })
        .then(() => {
            // Finally, return clues
            return clues
        })
})

Cypress.Commands.add(
    'generateClues',
    ({ testing = false, filePath = 'gameData.json' } = {}) => {
        let CLUES = []
        let GAME_DATA
        cy.fixture(filePath)
            .then((gameData) => {
                GAME_DATA = gameData
                // These are the words for today's bee — we'll sort them
                const words = gameData.today.answers.sort()

                // Then iterate and build clues
                for (let word of words) {
                    cy.getClues(word).then((clues) => {
                        console.log(JSON.stringify(clues, undefined, 2))
                        CLUES.push(clues)
                    })
                }
            })
            .then(() => {
                // Write clues to disk
                cy.writeFile('./cypress/fixtures/clues.json', CLUES)
            })
            .then(() => {
                // And finally, generate clues.html from clues.json
                cy.generateClueHTML(CLUES, GAME_DATA)
            })
    }
)

Cypress.Commands.add('generateClueHTML', (clues, gameData) => {
    console.log(JSON.stringify(clues, undefined, 2))
    console.log('Generating html clues for squarespace')
    let HTML = ''
    // Header :: the "branding"
    let header = formatHeader(gameData)
    // Clues :: the words themselves body of the html
    let htmlClues = formatClues(clues)
    // all html
    HTML += `${header}\n${htmlClues}`
    // Write the clues.html file
    cy.writeFile('./cypress/fixtures/clues.html', HTML).then(() => {
        return HTML
    })
})
