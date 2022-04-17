/// <reference types="cypress" />

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
