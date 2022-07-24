/// <reference types="cypress" />

/**
 * What this spec does:
 *  - Writes a file to disk: /cypress/fixtures/todays_bee.json
 *  - Note: ☝🏽 every file in fixtures is copied over to the S3 bucket 
 */

// Accepts either 2 arrays or 2 sets (or some combo of each)
// Returns a Set of items that ARE in set2 NOT CONTAINED by set1
const difference = (set1, set2) =>
    new Set([...set1].filter((item) => !set2.has(item)))

Cypress.Commands.add('getLetters', function () {
    let letters = []
    cy.get('div.hive')
        .within((hive) => {
            // Get the required letter
            cy.get('.hive-cell.center .cell-letter')
                .invoke('text')
                .then((t) => letters.push(t))
        })
        .then(() => {
            // Get the other letters
            cy.get('.hive-cell.outer .cell-letter').each(($letter) => {
                letters.push($letter.text())
            })
        })
        .then(() => {
            return letters.join('')
        })
})

describe('New York Spelling Bee Word Collector', function () {
    before(() => cy.viewport('macbook-16'))

    it('gets yesterdays words', function () {
        const dictionary_endpoint =
            'https://6ohunjaa18.execute-api.us-east-2.amazonaws.com/prod/nytimes-spelling-bee'
        // Initialize an empty array for all words from yesterday
        var y_words = []

        // Go to NYTimes spelling bee, and navigate to yesterday's words
        cy.visit('/puzzles/spelling-bee')
        cy.get('#portal-game-moments button:contains("Play")').click()

        // Now, get yesterday's words
        cy.get(`span[role="presentation"]:contains("Yesterday")`).click()

        // Collect all the words from yesterday – LOWERCASED
        cy.get('[data-testid="yesterdays-answer-word"]')
            .each((word) => {
                y_words.push(Cypress.$(word).text().trim().toLowerCase())
            })
            .then(() => {
                // Get the standard dictionary of words from the AWS endpoint
                cy.request({
                    method: 'POST',
                    url: dictionary_endpoint,
                }).then((resp) => {
                    // Create an Array consisting only of words of 4 or more chars
                    // WE WILL ASSUME THESE WORDS ARE LOWERCASED ALSO
                    let d_words = resp.body.body.words || []

                    // Create an array of NEW words that appear in yesterday's words
                    // that are not already in the dictionary (using difference function)
                    let new_words =
                        Array.from(
                            difference(new Set(y_words), new Set(d_words))
                        ) || []

                    // Dismiss yesterday's words
                    cy.get('.sb-modal-frame.yesterday [role="button"]').click()

                    // Create a new (sorted) array of dictionary words from the combo
                    // of existing dictionary words + new words (from yesterday)
                    let d_words_new = [...d_words, ...new_words].sort()

                    // Get today's letters
                    cy.getLetters().then((letters) => {
                        // Let's write a file
                        cy.log(`Todays letters...${letters}`)
                        cy.writeFile(
                            `./cypress/fixtures/todays_bee.json`,
                            JSON.stringify(
                                {
                                    todays_letters: letters,
                                    total_words_from_yesterday: y_words.length,
                                    total_words_added_from_yesterday:
                                        new_words.length,
                                    total_words_in_new_dictionary:
                                        d_words_new.length,
                                    new_words_from_yesterday: new_words,
                                    all_words_from_yesterday: y_words,
                                },
                                undefined,
                                2
                            )
                        )
                    })

                    // Write a text file to disk of the new dictionary
                    // TODO: Replace var `new_words` with `d_words_new` 👇🏽
                    cy.writeFile(
                        `./cypress/fixtures/dictionary_standard_new.txt`,
                        d_words_new.join('\n') + '\n'
                    )
                    // --------------------------------------------------
                    // TODO: Move the new file into the s3 bucket
                    // TODO: Git commit the new words
                    // Print out stuff
                    cy.log(
                        `Dictionary words 4 or more chars... ${d_words.length}`
                    )
                    cy.log(`Yesterdays words... ${y_words.length}`)
                    cy.log(
                        `New Words added to dictionary from yesterday... ${new_words.length}`
                    )
                    cy.log(`Size of new dictionary... ${d_words_new.length}`)
                    console.log(new_words)
                })
            })
    })
})
