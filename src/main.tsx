import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AVRStatusResponse } from "../server";

function App() {
	const [data, setData] = useState<AVRStatusResponse | null>(null);

	const fetchStatus = useCallback(async (): Promise<void> => {
		try {
			const res = await fetch("/api/status");
			const resData = (await res.json()) as {
				success: boolean;
			} & AVRStatusResponse;
			if (resData.success) {
				setData(resData);
			}
		} catch (e) {
			console.error("Status check offline:", e);
		}
	}, []); // Empty array means this function reference never changes

	const sendCommand = async (
		action: string,
		value?: string | number | boolean,
	) => {
		await fetch("/api/command", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action, value }),
		});
		fetchStatus(); // Fast update UI metrics
	};

	useEffect(() => {
		fetchStatus();
		const interval = setInterval(fetchStatus, 3000);
		return () => clearInterval(interval);
	}, [fetchStatus]);

	return (
		<div className="min-h-screen bg-base-300 flex items-center justify-center p-4">
			{/* Main Remote Card */}
			<div className="card w-full max-w-sm bg-base-100 shadow-2xl border border-neutral/20 overflow-hidden">
				{/* Header Block */}
				<div className="p-6 pb-4 bg-neutral text-neutral-content flex justify-between items-center shadow-md">
					<div>
						<h1 className="text-xl font-black tracking-tight text-white">
							AVR REMOTE
						</h1>
						<p className="text-xs opacity-70">Main Zone Control</p>
					</div>

					{/* Reactive Power Status Indicator Badge */}
					{data && (
						<div
							className={`badge ${data?.isPoweredOn ? "badge-success" : "badge-error"} badge-sm font-bold gap-1 px-3 py-2`}
						>
							<span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
							{data?.isPoweredOn ? "ON" : "STANDBY"}
						</div>
					)}
				</div>

				{/* Content Container Body */}
				<div className="card-body p-6 gap-6">
					{/* 1. POWER INTERACTION GRID */}
					<div className="grid grid-cols-2 gap-3">
						<button
							type="button"
							onClick={() => sendCommand("turnOn")}
							disabled={data?.isPoweredOn || !data}
							className="btn btn-success btn-md font-black shadow-sm"
						>
							POWER ON
						</button>

						<button
							type="button"
							onClick={() => sendCommand("turnOff")}
							disabled={!data?.isPoweredOn || !data}
							className="btn btn-error btn-md font-black shadow-sm"
						>
							STANDBY
						</button>
					</div>

					{/* 2. DYNAMIC INPUT SELECTOR ROUTER */}
					<div className="form-control w-full">
						<label htmlFor="source" className="label py-1">
							<span className="label-text font-bold text-neutral-content text-xs tracking-wider uppercase">
								Input
							</span>
						</label>
						<select
							id="source"
							disabled={!data}
							value={data?.currentSource.index}
							onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
								sendCommand("setSource", e.target.value)
							}
							className="select select-bordered select-primary w-full font-semibold"
						>
							{data?.availableInputs.map((input) => (
								<option key={input.index} value={input.index}>
									{input.name}
								</option>
							))}
						</select>
					</div>

					{/* 3. SOUND REVOLUTION DSP SELECTOR */}
					<div className="form-control w-full">
						<label htmlFor="soundMode" className="label py-1">
							<span className="label-text font-bold text-neutral-content text-xs tracking-wider uppercase">
								DSP Sound Mode
							</span>
						</label>
						<select
							disabled={!data}
							id="soundMode"
							value={data?.sound.currentIndex}
							onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
								sendCommand("setSoundMode", e.target.value)
							}
							className="select select-bordered select-secondary w-full font-semibold"
						>
							{data?.sound.availableModes.map((mode) => (
								<option key={mode.index} value={mode.index}>
									{mode.name}
								</option>
							))}
						</select>
					</div>

					{/* 4. MASTER COMPACT VOLUME CONTROLLER */}
					<div className="bg-base-200 p-4 rounded-2xl border border-neutral/10 space-y-3 shadow-inner">
						<div className="flex justify-between items-center">
							<span className="text-xs font-bold text-neutral-content uppercase tracking-wider">
								Volume level
							</span>
							<span className="text-3xl font-black text-primary font-mono tracking-tighter">
								{Number(data?.audio.volume) > 100
									? Number(data?.audio.volume) / 10
									: data?.audio.volume}{" "}
								<span className="text-sm font-normal text-neutral-content">
									dB
								</span>
							</span>
						</div>

						{/* Range Slider Knob */}
						<input
							disabled={!data}
							type="range"
							min="0"
							max="80"
							defaultValue={
								Number(data?.audio.volume) > 100
									? Math.floor(Number(data?.audio.volume) / 10)
									: Number(data?.audio.volume || 0)
							}
							key={Number(data?.audio.volume)}
							onMouseUp={(e: React.MouseEvent<HTMLInputElement>) =>
								sendCommand("setVolume", (e.target as HTMLInputElement).value)
							}
							onTouchEnd={(e: React.TouchEvent<HTMLInputElement>) =>
								sendCommand("setVolume", (e.target as HTMLInputElement).value)
							}
							className="range range-primary range-sm"
						/>

						{/* --- ADDED MUTE TOGGLE ROW --- */}
						<div className="form-control  p-2 flex px-3 flex-row justify-between items-center w-full">
							<span className="label-text text-xs font-bold text-neutral-content uppercase tracking-wider grow">
								{data?.audio.isMuted ? "🔇 Audio Muted" : "Audio Active"}
							</span>
							<input
								disabled={!data}
								type="checkbox"
								// Coerce various possible backend outputs safely into pure booleans
								checked={data?.audio.isMuted !== true}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									sendCommand("setMute", !e.target.checked)
								}
								className="toggle toggle-error toggle-sm"
							/>
						</div>

						{/* Direct Micro Step Buttons */}
						<div className="grid grid-cols-2 gap-2 pt-1">
							<button
								disabled={!data}
								type="button"
								onClick={() => {
									const currentVol =
										Number(data?.audio.volume) > 100
											? Math.floor(Number(data?.audio.volume) / 10)
											: Number(data?.audio.volume);
									sendCommand("setVolume", currentVol - 1);
								}}
								className="btn btn-neutral btn-sm font-bold text-xs"
							>
								VOL DOWN
							</button>

							<button
								disabled={!data}
								type="button"
								onClick={() => {
									const currentVol =
										Number(data?.audio.volume) > 100
											? Math.floor(Number(data?.audio.volume) / 10)
											: Number(data?.audio.volume);
									sendCommand("setVolume", currentVol + 1);
								}}
								className="btn btn-neutral btn-sm font-bold text-xs"
							>
								VOL UP
							</button>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<button
              type="button"
							onClick={() => sendCommand("wakeTheater")} // Calls our multi-device wake macro
							disabled={!data || data?.isPoweredOn}
							className="btn btn-success btn-md font-black shadow-sm"
						>
							WAKE THEATER
						</button>

						<button
							type="button"
							onClick={() => sendCommand("turnOff")}
							disabled={!data?.isPoweredOn}
							className="btn btn-error btn-md font-black shadow-sm"
						>
							STANDBY
						</button>
					</div>

					{/* 5. LIVESTREAM HUD STATE STATISTICS FEED */}
					<div className="stats stats-vertical bg-neutral text-neutral-content shadow-md rounded-xl text-sm overflow-hidden">
						<div className="stat min-h-11.25 py-3 px-4 flex justify-between items-center">
							<div className="stat-title text-xs text-neutral-content/60 font-bold uppercase">
								Stream Input
							</div>
							<div className="stat-value text-sm text-white font-bold">
								{data?.currentSource.name}
							</div>
						</div>
						<div className="stat min-h-11.25 py-3 px-4 flex justify-between items-center border-t border-neutral-content/10">
							<div className="stat-title text-xs text-neutral-content/60 font-bold uppercase">
								DSP Matrix
							</div>
							<div className="stat-value text-sm text-secondary font-bold">
								{data?.sound.currentMode}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

const rootElement = document.getElementById("root");

if (rootElement) {
	const root = createRoot(rootElement);
	root.render(<App />);
}
