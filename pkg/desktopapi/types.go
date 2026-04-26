package desktopapi

type CompareCommon struct {
	OutputFormat     string   `json:"outputFormat"`
	TextStyle        string   `json:"textStyle"`
	IgnorePaths      []string `json:"ignorePaths"`
	IgnoreWhitespace bool     `json:"ignoreWhitespace"`
	IgnoreCase       bool     `json:"ignoreCase"`
	IgnoreEOL        bool     `json:"ignoreEOL"`
}

type CompareJSONRequest struct {
	OldPath     string        `json:"oldPath"`
	NewPath     string        `json:"newPath"`
	Common      CompareCommon `json:"common"`
	IgnoreOrder bool          `json:"ignoreOrder"`
}

type CompareJSONValuesRequest struct {
	OldValue    string        `json:"oldValue"`
	NewValue    string        `json:"newValue"`
	Common      CompareCommon `json:"common"`
	IgnoreOrder bool          `json:"ignoreOrder"`
}

type CompareTextRequest struct {
	OldText string        `json:"oldText"`
	NewText string        `json:"newText"`
	Common  CompareCommon `json:"common"`
}

type LoadTextFileRequest struct {
	Path     string `json:"path"`
	Encoding string `json:"encoding,omitempty"`
}

type LoadTextFileResponse struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
}

type CompareDirectoriesRequest struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	Recursive   bool   `json:"recursive"`
	ShowSame    bool   `json:"showSame"`
	NameFilter  string `json:"nameFilter"`
}

type DirectoryCompareSummary struct {
	Total        int `json:"total"`
	Same         int `json:"same"`
	Changed      int `json:"changed"`
	LeftOnly     int `json:"leftOnly"`
	RightOnly    int `json:"rightOnly"`
	TypeMismatch int `json:"typeMismatch"`
	Error        int `json:"error"`
}

type DirectoryCompareItem struct {
	Name            string `json:"name"`
	RelativePath    string `json:"relativePath"`
	IsDir           bool   `json:"isDir"`
	Status          string `json:"status"`
	LeftPath        string `json:"leftPath"`
	RightPath       string `json:"rightPath"`
	LeftExists      bool   `json:"leftExists"`
	RightExists     bool   `json:"rightExists"`
	LeftKind        string `json:"leftKind"`
	RightKind       string `json:"rightKind"`
	LeftSize        int64  `json:"leftSize"`
	RightSize       int64  `json:"rightSize"`
	CompareModeHint string `json:"compareModeHint"`
	Message         string `json:"message,omitempty"`
}

type CompareDirectoriesResponse struct {
	CurrentPath    string                  `json:"currentPath"`
	ParentPath     string                  `json:"parentPath,omitempty"`
	ScannedSummary DirectoryCompareSummary `json:"scannedSummary"`
	CurrentSummary DirectoryCompareSummary `json:"currentSummary"`
	Items          []DirectoryCompareItem  `json:"items"`
	Error          string                  `json:"error,omitempty"`
}

type CompareResponse struct {
	ExitCode  int    `json:"exitCode"`
	DiffFound bool   `json:"diffFound"`
	Output    string `json:"output"`
	Error     string `json:"error,omitempty"`
}

type JSONRichDiffItem struct {
	Type     string `json:"type"` // added | removed | changed | type_changed
	Path     string `json:"path"`
	OldValue any    `json:"oldValue,omitempty"`
	NewValue any    `json:"newValue,omitempty"`
}

type JSONRichSummary struct {
	Added       int `json:"added"`
	Removed     int `json:"removed"`
	Changed     int `json:"changed"`
	TypeChanged int `json:"typeChanged"`
}

type CompareJSONRichResponse struct {
	Result   CompareResponse    `json:"result"`
	DiffText string             `json:"diffText"`
	Summary  JSONRichSummary    `json:"summary"`
	Diffs    []JSONRichDiffItem `json:"diffs"`
}

type DesktopJSONSession struct {
	OldSourcePath string        `json:"oldSourcePath"`
	NewSourcePath string        `json:"newSourcePath"`
	IgnoreOrder   bool          `json:"ignoreOrder"`
	Common        CompareCommon `json:"common"`
}

type DesktopTextSession struct {
	OldSourcePath string        `json:"oldSourcePath"`
	NewSourcePath string        `json:"newSourcePath"`
	Common        CompareCommon `json:"common"`
	DiffLayout    string        `json:"diffLayout"`
}

type DesktopDirectorySession struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	ViewMode    string `json:"viewMode"`
}

type DesktopRecentPair struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
	UsedAt  string `json:"usedAt"`
}

type DesktopRecentDirectoryPair struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	ViewMode    string `json:"viewMode"`
	UsedAt      string `json:"usedAt"`
}

type DesktopTabSession struct {
	ID           string                  `json:"id"`
	Label        string                  `json:"label"`
	LastUsedMode string                  `json:"lastUsedMode"`
	JSON         DesktopJSONSession      `json:"json"`
	Text         DesktopTextSession      `json:"text"`
	Directory    DesktopDirectorySession `json:"directory"`
}

type DesktopState struct {
	Version              int                          `json:"version"`
	Tabs                 []DesktopTabSession          `json:"tabs"`
	ActiveTabID          string                       `json:"activeTabId"`
	JSONRecentPairs      []DesktopRecentPair          `json:"jsonRecentPairs"`
	TextRecentPairs      []DesktopRecentPair          `json:"textRecentPairs"`
	DirectoryRecentPairs []DesktopRecentDirectoryPair `json:"directoryRecentPairs"`
}

type ExplainDiffRequest struct {
	DiffText string `json:"diffText"`
	Mode     string `json:"mode"`
	Language string `json:"language,omitempty"`
	Model    string `json:"model,omitempty"`
}

type ExplainDiffResponse struct {
	Explanation string `json:"explanation"`
	Provider    string `json:"provider"`
	Model       string `json:"model"`
	Error       string `json:"error,omitempty"`
}

type AIProviderStatus struct {
	Available       bool     `json:"available"`
	Provider        string   `json:"provider,omitempty"`
	BaseURL         string   `json:"baseUrl,omitempty"`
	Models          []string `json:"models,omitempty"`
	Error           string   `json:"error,omitempty"`
	OllamaInstalled bool     `json:"ollamaInstalled"`
	OllamaReachable bool     `json:"ollamaReachable"`
	CanAutoStart    bool     `json:"canAutoStart"`
	HardwareTier    string   `json:"hardwareTier,omitempty"` // "low" | "mid" | "high" | ""
}

type AISetupRequest struct {
	Model string `json:"model,omitempty"`
}

type AISetupProgress struct {
	Phase         string  `json:"phase"`
	Message       string  `json:"message,omitempty"`
	Error         string  `json:"error,omitempty"`
	Model         string  `json:"model,omitempty"`
	PullCompleted int64   `json:"pullCompleted,omitempty"`
	PullTotal     int64   `json:"pullTotal,omitempty"`
	PullPercent   float64 `json:"pullPercent,omitempty"`
}
