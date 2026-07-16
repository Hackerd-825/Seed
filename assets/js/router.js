const Router = {
    generateRandomSeed: function() {
        return Math.floor(Math.random() * 9999999).toString();
    },
    getQueryParams: function() {
        const urlParams = new URLSearchParams(window.location.search);
        return Object.fromEntries(urlParams.entries());
    },
    getSeedOrRedirect: function() {
        const params = this.getQueryParams();
        if (!params.seed) {
            const newSeed = this.generateRandomSeed();
            this.navigateTo(window.location.pathname.split('/').pop() || 'index.html', newSeed);
            return newSeed;
        }
        return params.seed;
    },
    navigateTo: function(page, seed) {
        window.location.href = `${page}?seed=${seed}`;
    }
};
