/// <reference types="cypress" />

/**
 * What this spec does:
 *  - Writes a file to disk: /cypress/fixtures/gameData.json
 *  - Note: ☝🏽 every file in fixtures is copied over to the S3 bucket 
 */

 describe('New York Spelling Bee Word Collector', function () {
    before(function () {
        cy.viewport('macbook-16')
        cy.visit('/puzzles/spelling-bee')
    })

    it('gets game data', function () {
        cy.window().then((win) => {
            let gd = win.gameData
            cy.writeFile('./cypress/fixtures/gameData.json', gd)
        })
    })
})
