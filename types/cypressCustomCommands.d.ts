declare namespace Cypress {
    interface Chainable<Subject> {
        /**
         * @description Asserts that document.readyState === 'complete'
         *   - Uses `cy.waitUntil()`
         *   - Logs when finished waiting
         */
        waitForPageToLoad(): VoidFunction
        removeFluff(post: any): Chainable<any>
        getWordCount(text: any): Chainable<any>
        makeMD(post: any): Chainable<any>
        loginToSquarespace(email: any, password: any): Chainable<any>
        navigateToDashboard(): Chainable<any>
        deleteSubstackPost(undefined?: object): Chainable<any>
        findSubstackPostsByTitle(title?: any): Chainable<any>
        waitForPresence(): Chainable<any>

        /**
         * @description Creates substack post via the UI. Assumes
         * @example
         * // Specify some html
         * let html = `<h1><p>wow</p></h1>`
         * // Call the method...
         * cy.createSubstackPost({title:'My first post', subtitle:55, htmlContent: html });
         *
         */
        createSubstackPost(props: {
            title: string
            subtitle: string
            htmlContent: string
            textContent: string
        }): Chainable<any>
    }
}
