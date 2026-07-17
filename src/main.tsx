import { useEffect, useState, useCallback } from "react";
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

	const sendCommand = async (action: string, value?: string | number) => {
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
		<div
			style={{
				padding: 30,
				maxWidth: 440,
				margin: "40px auto",
				background: "#222",
				borderRadius: 12,
				boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<h2 style={{ margin: 0 }}>📻 AVR Dashboard</h2>

				{/* Live Power Indicator Status Badge */}
				<span
					style={{
						padding: "6px 12px",
						borderRadius: 20,
						fontSize: 12,
						fontWeight: "bold",
						background: data?.isPoweredOn ? "#22c55e" : "#ef4444",
						color: "#fff",
					}}
				>
					{data?.isPoweredOn ? "● POWERED ON" : "○ STANDBY"}
				</span>
			</div>
			<hr style={{ borderColor: "#444", margin: "20px 0" }} />

			{/* Power Control Command Elements */}
			<div style={{ display: "flex", gap: 10, marginBottom: 25 }}>
				<button
					type="button"
					onClick={() => sendCommand("turnOn")}
					disabled={data?.isPoweredOn} // Disables the button if the device is already ON
					style={{
						flex: 1,
						padding: 12,
						background: data?.isPoweredOn ? "#444" : "#10b981", // Turn grey when disabled
						color: data?.isPoweredOn ? "#aaa" : "#fff",
						fontWeight: "bold",
						borderRadius: 6,
						border: "none",
						cursor: data?.isPoweredOn ? "not-allowed" : "pointer",
					}}
				>
					POWER ON
				</button>

				<button
					type="button"
					onClick={() => sendCommand("turnOff")}
					disabled={!data?.isPoweredOn} // Disables the button if the device is already in STANDBY
					style={{
						flex: 1,
						padding: 12,
						background: !data?.isPoweredOn ? "#444" : "#dc2626", // Turn grey when disabled
						color: !data?.isPoweredOn ? "#aaa" : "#fff",
						fontWeight: "bold",
						borderRadius: 6,
						border: "none",
						cursor: !data?.isPoweredOn ? "not-allowed" : "pointer",
					}}
				>
					STANDBY
				</button>
			</div>

			<div style={{ marginBottom: 25 }}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: 8,
					}}
				>
					<span style={{ fontSize: 14, color: "#aaa" }}>
						🎛️ Volume Master Control
					</span>
					{/* Format display level from 3 digits back down to readable decimal metric */}
					<span style={{ fontWeight: "bold", color: "#10b981" }}>
						{Number(data?.audio.volume) > 100
							? Number(data?.audio.volume) / 10
							: data?.audio.volume}{" "}
						dB
					</span>
				</div>

				{/* Slider Range Interface */}
				<input
					type="range"
					min="0"
					max="80"
					// Read state safely, scaling down 3-digit values if necessary
					defaultValue={
						Number(data?.audio.volume) > 100
							? Math.floor(Number(data?.audio.volume) / 10)
							: Number(data?.audio.volume || 0)
					}
					// Use key forces React to reset the handle position when background polling receives updates
					key={Number(data?.audio.volume)}
					// Fires instantly upon mouse release on Desktop systems
					onMouseUp={(e: React.MouseEvent<HTMLInputElement>) =>
						sendCommand("setVolume", (e.target as HTMLInputElement).value)
					}
					// Fires instantly upon finger lift on mobile touch screens
					onTouchEnd={(e: React.TouchEvent<HTMLInputElement>) =>
						sendCommand("setVolume", (e.target as HTMLInputElement).value)
					}
					style={{
						width: "100%",
						accentColor: "#10b981",
						cursor: "pointer",
						marginBottom: 12,
					}}
				/>

				{/* Precision Step Micro-Adjustment Buttons */}
				<div style={{ display: "flex", gap: 10 }}>
					<button
						type="button"
						onClick={() => {
							const currentVol =
								Number(data?.audio.volume) > 100
									? Math.floor(Number(data?.audio.volume) / 10)
									: Number(data?.audio.volume);
							sendCommand("setVolume", currentVol - 1);
						}}
						style={{
							flex: 1,
							padding: "8px",
							background: "#333",
							border: "1px solid #444",
							color: "#fff",
							borderRadius: 6,
							cursor: "pointer",
							fontSize: 13,
						}}
					>
						🔉 VOL DOWN (-1)
					</button>
					<button
						type="button"
						onClick={() => {
							const currentVol =
								Number(data?.audio.volume) > 100
									? Math.floor(Number(data?.audio.volume) / 10)
									: Number(data?.audio.volume);
							sendCommand("setVolume", currentVol + 1);
						}}
						style={{
							flex: 1,
							padding: "8px",
							background: "#333",
							border: "1px solid #444",
							color: "#fff",
							borderRadius: 6,
							cursor: "pointer",
							fontSize: 13,
						}}
					>
						🔊 VOL UP (+1)
					</button>
				</div>
			</div>

			{/* Dynamic Selector for Changing Input Sources */}
			<div style={{ marginBottom: 25 }}>
				<span
					style={{
						display: "block",
						marginBottom: 8,
						fontSize: 14,
						color: "#aaa",
					}}
				>
					🔌 Switch Input Channel
				</span>
				<select
					value={data?.currentSource?.index ?? ""}
					onChange={(e) => sendCommand("setSource", e.target.value)}
					style={{
						width: "100%",
						padding: 12,
						borderRadius: 6,
						background: "#333",
						color: "#fff",
						border: "1px solid #444",
						fontSize: 16,
						cursor: "pointer",
					}}
				>
					<option value="" disabled>
						-- Select a Source Input Channel --
					</option>
					{data?.availableInputs?.map(
						(input: { index: number; name: string }) => (
							<option key={input.index} value={input.index}>
								{input.name} (Ch {input.index})
							</option>
						),
					)}
				</select>
			</div>

			{/* Dynamic Selector for Changing Sound Modes */}
			<div style={{ marginBottom: 25 }}>
				<span
					style={{
						display: "block",
						marginBottom: 8,
						fontSize: 14,
						color: "#aaa",
					}}
				>
					🎛️ DSP Sound Profile Mode
				</span>
				<select
					value={data?.sound.currentIndex}
					onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
						sendCommand("setSoundMode", e.target.value)
					}
					style={{
						width: "100%",
						padding: 12,
						borderRadius: 6,
						background: "#333",
						color: "#fff",
						border: "1px solid #444",
						fontSize: 16,
						cursor: "pointer",
					}}
				>
					{data?.sound.availableModes.map((mode) => (
						<option key={mode.index} value={mode.index}>
							{mode.name}
						</option>
					))}
				</select>
			</div>

			{/* Update your Metadata Readout Section Card to view the text-label state */}
			<div
				style={{
					background: "#1a1a1a",
					padding: 15,
					borderRadius: 8,
					fontSize: 15,
				}}
			>
				<p style={{ margin: "0 0 10px 0" }}>
					🔊 <strong>Active Volume Level:</strong> {data?.audio.volume} dB
				</p>
				<p style={{ margin: "0 0 10px 0" }}>
					🎯 <strong>Active Audio Stream:</strong> {data?.currentSource.name}
				</p>
				<p style={{ margin: 0 }}>
					🎚️ <strong>Active Sound Processing Mode:</strong>{" "}
					{data?.sound.currentMode}
				</p>
			</div>

			{/* Active Room Metadata Readouts */}
			<div
				style={{
					background: "#1a1a1a",
					padding: 15,
					borderRadius: 8,
					fontSize: 15,
				}}
			>
				<p style={{ margin: "0 0 10px 0" }}>
					🔊 <strong>Active Volume Level:</strong> {data?.audio?.volume ?? "--"}{" "}
					dB
				</p>
				<p style={{ margin: 0 }}>
					🎯 <strong>Active Audio Stream Destination:</strong>{" "}
					{data?.currentSource?.name || "Unknown Channel"}
				</p>
			</div>
		</div>
	);
}

const rootElement = document.getElementById("root");

if (rootElement) {
	const root = createRoot(rootElement);
	root.render(<App />);
}
