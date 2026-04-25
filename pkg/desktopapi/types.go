package desktopapi

type CompareCommon struct {
	FailOn       string   `json:"failOn"`
	OutputFormat string   `json:"outputFormat"`
	TextStyle    string   `json:"textStyle"`
	IgnorePaths  []string `json:"ignorePaths"`
	ShowPaths    bool     `json:"showPaths"`
	OnlyBreaking bool     `json:"onlyBreaking"`
	NoColor      bool     `json:"noColor"`
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
	Path string `json:"path"`
}

type LoadTextFileResponse struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type CompareFoldersRequest struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	Recursive   bool   `json:"recursive"`
	ShowSame    bool   `json:"showSame"`
	NameFilter  string `json:"nameFilter"`
}

type FolderCompareSummary struct {
	Total        int `json:"total"`
	Same         int `json:"same"`
	Changed      int `json:"changed"`
	LeftOnly     int `json:"leftOnly"`
	RightOnly    int `json:"rightOnly"`
	TypeMismatch int `json:"typeMismatch"`
	Error        int `json:"error"`
}

type FolderCompareItem struct {
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

type CompareFoldersResponse struct {
	CurrentPath    string               `json:"currentPath"`
	ParentPath     string               `json:"parentPath,omitempty"`
	ScannedSummary FolderCompareSummary `json:"scannedSummary"`
	CurrentSummary FolderCompareSummary `json:"currentSummary"`
	Items          []FolderCompareItem  `json:"items"`
	Error          string               `json:"error,omitempty"`
}

type RunScenarioRequest struct {
	ScenarioPath string   `json:"scenarioPath"`
	ReportFormat string   `json:"reportFormat"`
	Only         []string `json:"only"`
}

type ListScenarioChecksRequest struct {
	ScenarioPath string   `json:"scenarioPath"`
	ReportFormat string   `json:"reportFormat"`
	Only         []string `json:"only"`
}

type CompareResponse struct {
	ExitCode  int      `json:"exitCode"`
	DiffFound bool     `json:"diffFound"`
	Output    string   `json:"output"`
	Error     string   `json:"error,omitempty"`
	Paths     []string `json:"paths,omitempty"`
}

type JSONRichDiffItem struct {
	Type     string `json:"type"` // added | removed | changed | type_changed
	Path     string `json:"path"`
	OldValue any    `json:"oldValue,omitempty"`
	NewValue any    `json:"newValue,omitempty"`
	Breaking bool   `json:"breaking"`
}

type JSONRichSummary struct {
	Added       int `json:"added"`
	Removed     int `json:"removed"`
	Changed     int `json:"changed"`
	TypeChanged int `json:"typeChanged"`
	Breaking    int `json:"breaking"`
}

type CompareJSONRichResponse struct {
	Result   CompareResponse    `json:"result"`
	DiffText string             `json:"diffText"`
	Summary  JSONRichSummary    `json:"summary"`
	Diffs    []JSONRichDiffItem `json:"diffs"`
}

type ScenarioSummary struct {
	Total    int `json:"total"`
	OK       int `json:"ok"`
	Diff     int `json:"diff"`
	Error    int `json:"error"`
	ExitCode int `json:"exitCode"`
}

type ScenarioResult struct {
	Name         string `json:"name"`
	Kind         string `json:"kind"`
	Status       string `json:"status"`
	ExitCode     int    `json:"exitCode"`
	DiffFound    bool   `json:"diffFound"`
	Output       string `json:"output,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

type ScenarioRunResponse struct {
	ExitCode int              `json:"exitCode"`
	Summary  *ScenarioSummary `json:"summary,omitempty"`
	Results  []ScenarioResult `json:"results,omitempty"`
	Output   string           `json:"output,omitempty"`
	Error    string           `json:"error,omitempty"`
}

type ScenarioCheckListEntry struct {
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	Old     string `json:"old"`
	New     string `json:"new"`
	Summary string `json:"summary"`
}

type ScenarioListResponse struct {
	ExitCode int                      `json:"exitCode"`
	Checks   []ScenarioCheckListEntry `json:"checks,omitempty"`
	Output   string                   `json:"output,omitempty"`
	Error    string                   `json:"error,omitempty"`
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

type DesktopFolderSession struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	ViewMode    string `json:"viewMode"`
}

type DesktopScenarioSession struct {
	ScenarioPath string `json:"scenarioPath"`
	ReportFormat string `json:"reportFormat"`
}

type DesktopRecentPair struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
	UsedAt  string `json:"usedAt"`
}

type DesktopRecentFolderPair struct {
	LeftRoot    string `json:"leftRoot"`
	RightRoot   string `json:"rightRoot"`
	CurrentPath string `json:"currentPath"`
	ViewMode    string `json:"viewMode"`
	UsedAt      string `json:"usedAt"`
}

type DesktopRecentScenarioPath struct {
	Path         string `json:"path"`
	ReportFormat string `json:"reportFormat"`
	UsedAt       string `json:"usedAt"`
}

type DesktopState struct {
	Version             int                         `json:"version"`
	LastUsedMode        string                      `json:"lastUsedMode"`
	JSON                DesktopJSONSession          `json:"json"`
	Text                DesktopTextSession          `json:"text"`
	Folder              DesktopFolderSession        `json:"folder"`
	Scenario            DesktopScenarioSession      `json:"scenario"`
	JSONRecentPairs     []DesktopRecentPair         `json:"jsonRecentPairs"`
	TextRecentPairs     []DesktopRecentPair         `json:"textRecentPairs"`
	FolderRecentPairs   []DesktopRecentFolderPair   `json:"folderRecentPairs"`
	ScenarioRecentPaths []DesktopRecentScenarioPath `json:"scenarioRecentPaths"`
}
