package desktopapi

import (
	"bufio"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// detectHardwareTier returns "low", "mid", "high", or "" if unknown.
// Thresholds use total RAM:
//
//	< 8 GB   → low   (recommend Compact, block High Quality)
//	8-16 GB  → mid   (recommend Balanced)
//	> 16 GB  → high  (all tiers OK, default Balanced)
func detectHardwareTier() string {
	bytes := totalRAMBytes()
	if bytes <= 0 {
		return ""
	}
	gb := float64(bytes) / (1024 * 1024 * 1024)
	switch {
	case gb < 8:
		return "low"
	case gb <= 16:
		return "mid"
	default:
		return "high"
	}
}

func totalRAMBytes() int64 {
	switch runtime.GOOS {
	case "darwin":
		return darwinMemSize()
	case "linux":
		return linuxMemSize()
	default:
		return 0
	}
}

func darwinMemSize() int64 {
	out, err := exec.Command("sysctl", "-n", "hw.memsize").Output()
	if err != nil {
		return 0
	}
	n, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64)
	if err != nil {
		return 0
	}
	return n
}

func linuxMemSize() int64 {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0
	}
	defer func() { _ = f.Close() }()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "MemTotal:") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			return 0
		}
		kb, err := strconv.ParseInt(fields[1], 10, 64)
		if err != nil {
			return 0
		}
		return kb * 1024
	}
	return 0
}
