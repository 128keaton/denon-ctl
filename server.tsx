import { avr } from "./avr-client";

const PORT = 3000;

export interface AVRStatusResponse {
	isPoweredOn: boolean;
	currentSource: {
		index: number;
		name: string;
		zone: number;
	};
	audio: {
		volume: number;
		isMuted: boolean;
		bass: number;
		// Include any other typed keys your discovery engine found
	};
	availableInputs: Array<{
		index: number;
		name: string;
	}>;
	sound: {
		currentMode: string;
		currentIndex: number;
		availableModes: Array<{ index: number; name: string }>;
	};
}

async function buildFrontend() {
  const result = await Bun.build({
    entrypoints: ['./src/main.tsx'],
    outdir: './dist',
  });
  if (!result.success) console.error("Bun bundle failed:", result.logs);
}


Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/" || url.pathname === "/src/main.tsx") {
			await buildFrontend();
		}

		// --- API ENDPOINTS ---
		if (url.pathname === "/api/status" && req.method === "GET") {
			try {
				// Fetch current active metrics and the available input map concurrently
				const [currentSource, audioStatus, sourceMap, powerState, soundMap] =
					await Promise.all([
						avr.getCurrentSource(),
						avr.getAudioStatus(),
						avr.getSources(),
						avr.getPowerState(),
						avr.getSoundModes(), // Fire new discovery helper
					]);

				// Evaluate your power flag based on the layout state your generator found
				const isDevicePoweredOn = powerState;

				return Response.json({
					success: true,
					isPoweredOn: isDevicePoweredOn,
					currentSource,
					audio: audioStatus,
					availableInputs: sourceMap.inputs, // Passing down [{ index: 0, name: 'CBL/SAT' }, ...]
					sound: {
						currentMode: soundMap.currentMode,
						currentIndex: soundMap.currentIndex,
						availableModes: soundMap.modes,
					},
				});
			} catch (err) {
				return Response.json(
					{ success: false, error: String(err) },
					{ status: 500 },
				);
			}
		}

		if (url.pathname === "/api/command" && req.method === "POST") {
			const { action, value } = (await req.json()) as {
				action: string;
				value: string | number;
			};
			if (action === "turnOn") await avr.turnOn();
			if (action === "turnOff") await avr.turnOff();
			if (action === "setSource") await avr.setSource(value); // Handles input routing channel updates
			if (action === "setSoundMode") await avr.setSoundMode(value);
			if (action === "setVolume") await avr.setVolume(value);
			return Response.json({ success: true });
		}

		// --- STATIC SERVING ---
        if (url.pathname === "/") return new Response(Bun.file("./index.html"));
				if (url.pathname === "/main.css") return new Response(Bun.file("./dist/main.css"));
		if (url.pathname === "/src/main.tsx")
			return new Response(Bun.file("./dist/main.js"));

		return new Response("Not Found", { status: 404 });
	},
});

console.log(`🚀 Fullstack Control Server running on http://localhost:${PORT}`);
