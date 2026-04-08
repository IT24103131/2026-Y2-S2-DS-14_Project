import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

export default function OCEANChart({ ocean }) {
    if (!ocean) return null;

    const data = [
        { trait: "Openness", value: ocean.openness ?? 0 },
        { trait: "Conscientiousness", value: ocean.conscientiousness ?? 0 },
        { trait: "Extraversion", value: ocean.extraversion ?? 0 },
        { trait: "Agreeableness", value: ocean.agreeableness ?? 0 },
        { trait: "Neuroticism", value: ocean.neuroticism ?? 0 },
    ];

    return (
        <div className="w-full" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={data}>
                    <PolarGrid stroke="rgba(255,255,255,0.18)" />
                    <PolarAngleAxis
                        dataKey="trait"
                        tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <Radar
                        name="Personality"
                        dataKey="value"
                        stroke="#7ab8b0"
                        fill="#7ab8b0"
                        fillOpacity={0.3}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "#2d4a47",
                            border: "1px solid rgba(122,184,176,0.4)",
                            borderRadius: 8,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 12,
                            color: "#e8f0ef",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}