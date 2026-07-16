class WorldNoise {
    constructor(seedString) {
        this.seedString = seedString;
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
            hash = ((hash << 5) - hash) + seedString.charCodeAt(i); hash |= 0;
        }
        this.seedHash = Math.abs(hash);
        const prng = () => {
            hash = (hash * 48271) % 2147483647;
            return (hash - 1) / 2147483646;
        };
        this.noiseGenerator = new SimplexNoise(prng);
    }
    getNoise2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let total = 0, frequency = 1.0, amplitude = 1.0, maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            total += this.noiseGenerator.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude; amplitude *= persistence; frequency *= lacunarity;
        }
        return total / maxValue;
    }
}
