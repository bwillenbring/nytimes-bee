/// <reference types="cypress" />

/**
 * What this spec does:
 *  - Writes the following files to disk:
 *      1. /cypress/fixtures/gameData.json
 *      2. /cypress/fixtures/clues.json (only important for clues.html)
 *      3. /cypress/fixtures/clues.html (required for substack post)
 *
 *  - Note: ☝🏽 every file in fixtures is copied over to the S3 bucket
 */

describe('New York Spelling Bee Word Collector', function () {
    before(function () {
        // Explicitly set the baseUrl
        Cypress.config('baseUrl', Cypress.config('urls').nytimes)
        cy.viewport('macbook-16')
        cy.visit('/puzzles/spelling-bee')
    })

    it('gets game data', function () {
        cy.window()
            .then((win) => {
                let gd = win.gameData
                cy.writeFile('./cypress/fixtures/gameData.json', gd)
            })
            .then(() => {
                // Now we will generate clues.json & clues.html from gameData.json
                cy.generateClues()
                // The next `describe` section handles the creation of the substack post
            })
    }) // end test case
})

describe.only('Substack Post Creation', () => {
    before(() => {
        // Explicitly set the baseUrl
        Cypress.config(
            'baseUrl',
            Cypress.config('baseUrl', Cypress.config('urls').substack)
        )
    })

    // Get API credentials from cypress env vars
    // These are injected at runtime in CI, as github secrets
    const [email, password] = [
        Cypress.env('SQ_EMAIL'),
        Cypress.env('SQ_PASSWORD'),
    ]

    beforeEach(() => {
        cy.intercept('*api/v1/drafts/*/presence').as('presence')
        // This login function uses cy.session for cached sessions
        cy.loginToSubstack(email, password)
    })

    it.skip('creates a substack post draft', () => {
        // Assume that at this point, clues.html is already generated
        // Set up vars
        let dayOfWeek = Cypress.dayjs().format('dddd')
        let titleContent, subtitleContent
        cy.getTimestamp().then((t) => {
            cy.fixture('clues.html').then((htmlContent) => {
                // Create the substack post
                cy.createSubstackPost({
                    title: `NYT 🐝 Clues—${t}`,
                    subtitle: `Clues for ${dayOfWeek}'s New York Times Spelling Bee`,
                    htmlContent: htmlContent,
                }).then(() => {
                    // cy.navigateToDashboard()
                })
            })
        })
    }) // end test case

    it('visits a page', () => {
        cy.visit('/p/nyt-cluesmon-25-july-2022').then(() => {
            cy.waitForPageToLoad()
            cy.contains(`Monday's New York Times Spelling Bee`)
        })
    })

    it('visits a second page', () => {
        cy.visit('/p/nyt-cluessun-24-july-2022').then(() => {
            cy.waitForPageToLoad()
            cy.contains(`Sunday's New York Times Spelling Bee`)
        })
    })
})
