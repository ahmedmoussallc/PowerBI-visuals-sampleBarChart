import powerbi from "powerbi-visuals-api";
import { select, Selection } from "d3-selection";
import { scaleBand, scaleLinear } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import { max } from "d3-array";
import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { formattingSettingsService, VisualSettings } from "./settings";

import IVisual = powerbi.extensibility.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewCategorical = powerbi.DataViewCategorical;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import "../style/visual.less";

interface BarDataPoint {
    category: string;
    value: number;
    color: string;
    selectionId: ISelectionId;
    tooltipInfo: VisualTooltipDataItem[];
    highlight?: number;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private svg: Selection<SVGSVGElement, unknown, HTMLElement, any>;
    private barGroup: Selection<SVGGElement, unknown, HTMLElement, any>;
    private xAxisGroup: Selection<SVGGElement, unknown, HTMLElement, any>;
    private yAxisGroup: Selection<SVGGElement, unknown, HTMLElement, any>;
    private settings: VisualSettings;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private selectionManager: ISelectionManager;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

        this.svg = select(options.element)
            .append("svg")
            .classed("roundedBarChart", true);
        this.barGroup = this.svg.append("g");
        this.xAxisGroup = this.svg.append("g").classed("xAxis", true);
        this.yAxisGroup = this.svg.append("g").classed("yAxis", true);
    }

    public update(options: VisualUpdateOptions): void {
        const viewPort = options.viewport;
        this.svg.attr("width", viewPort.width).attr("height", viewPort.height);

        this.settings = formattingSettingsService.populateFormattingSettingsModel(VisualSettings, options.dataViews[0]) as VisualSettings;

        const dataView = options.dataViews[0];
        if (!dataView || !dataView.categorical || !dataView.categorical.categories || !dataView.categorical.values) {
            return;
        }
        const categorical = dataView.categorical as DataViewCategorical;
        const categoryColumn = categorical.categories[0];
        const valueColumn = categorical.values[0];
        const highlights = valueColumn.highlights;
        const colorPalette = this.host.colorPalette;
        const isHighContrast = colorPalette.isHighContrast;
        const defaultColor = this.settings.dataColors.defaultColor.value.value;

        const data: BarDataPoint[] = categoryColumn.values.map((c, i) => {
            const selectionId = this.host.createSelectionIdBuilder()
                .withCategory(categoryColumn, i)
                .createSelectionId();
            const paletteColor = colorPalette.getColor(String(categoryColumn.values[i])).value;
            return {
                category: String(c),
                value: <number>valueColumn.values[i],
                color: defaultColor || paletteColor,
                selectionId,
                tooltipInfo: [{ displayName: categoryColumn.source.displayName, value: String(c) }, { displayName: valueColumn.source.displayName, value: String(valueColumn.values[i]) }],
                highlight: highlights && highlights[i] != null ? <number>highlights[i] : undefined
            };
        });

        const horizontal = this.settings.barCard.horizontal.value;
        const radius = this.settings.barCard.cornerRadius.value;

        const maxBars = 100;
        const sliced = data.slice(0, maxBars);
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const width = viewPort.width - margin.left - margin.right;
        const height = viewPort.height - margin.top - margin.bottom;
        const g = this.barGroup.attr("transform", `translate(${margin.left},${margin.top})`);

        if (horizontal) {
            const y = scaleBand<string>()
                .domain(sliced.map(d => d.category))
                .range([0, height])
                .padding(0.1);
            const x = scaleLinear()
                .domain([0, max(sliced, d => Math.max(d.value, d.highlight ?? 0)) || 0])
                .range([0, width]);

            this.yAxisGroup.attr("transform", `translate(${margin.left},${margin.top})`).call(axisLeft(y));
            this.xAxisGroup.attr("transform", `translate(${margin.left},${margin.top + height})`).call(axisBottom(x));

            const bars = g.selectAll<SVGGElement, BarDataPoint>("g.bar").data(sliced, d => d.category);
            const barsEnter = bars.enter().append("g")
                .classed("bar", true)
                .attr("tabindex", 0)
                .attr("role", "graphics-symbol")
                .attr("aria-label", d => `${d.category}: ${d.value}`);
            barsEnter.append("rect").classed("highlight", true);
            barsEnter.append("rect").classed("main", true);

            const barMerge = barsEnter.merge(bars);

            barMerge.select<SVGRectElement>("rect.main")
                .attr("y", d => y(d.category)!)
                .attr("height", y.bandwidth())
                .attr("x", 0)
                .attr("rx", radius)
                .attr("ry", radius)
                .attr("width", d => x(d.value))
                .attr("fill", d => isHighContrast ? colorPalette.foreground.value : d.color)
                .attr("fill-opacity", d => d.highlight != null ? 0.4 : 1)
                .attr("stroke", isHighContrast ? colorPalette.foreground.value : null)
                .style("cursor", "pointer");

            barMerge.select<SVGRectElement>("rect.highlight")
                .attr("y", d => y(d.category)!)
                .attr("height", y.bandwidth())
                .attr("x", 0)
                .attr("rx", radius)
                .attr("ry", radius)
                .attr("width", d => x(d.highlight ?? d.value))
                .attr("fill", d => isHighContrast ? colorPalette.foreground.value : d.color)
                .style("pointer-events", "none");

            barMerge
                .on("click", (event, d) => {
                    const isCtrl = (<MouseEvent>event).ctrlKey;
                    this.selectionManager.select(d.selectionId, isCtrl);
                })
                .on("contextmenu", (event, d) => {
                    event.preventDefault();
                    this.selectionManager.showContextMenu(d.selectionId, { x: (<MouseEvent>event).clientX, y: (<MouseEvent>event).clientY });
                })
                .on("keydown", (event, d) => {
                    if ((<KeyboardEvent>event).key === "Enter") {
                        this.selectionManager.select(d.selectionId, false);
                    }
                })
                .each((d, i, nodes) => {
                    const node = select(nodes[i]);
                    this.tooltipServiceWrapper.addTooltip(node, () => d.tooltipInfo);
                });

            bars.exit().remove();
        } else {
            const x = scaleBand<string>()
                .domain(sliced.map(d => d.category))
                .range([0, width])
                .padding(0.1);
            const y = scaleLinear()
                .domain([0, max(sliced, d => Math.max(d.value, d.highlight ?? 0)) || 0])
                .range([height, 0]);
            this.xAxisGroup.attr("transform", `translate(${margin.left},${margin.top + height})`).call(axisBottom(x));
            this.yAxisGroup.attr("transform", `translate(${margin.left},${margin.top})`).call(axisLeft(y));

            const bars = g.selectAll<SVGGElement, BarDataPoint>("g.bar").data(sliced, d => d.category);
            const barsEnter = bars.enter().append("g")
                .classed("bar", true)
                .attr("tabindex", 0)
                .attr("role", "graphics-symbol")
                .attr("aria-label", d => `${d.category}: ${d.value}`);
            barsEnter.append("rect").classed("highlight", true);
            barsEnter.append("rect").classed("main", true);

            const barMerge = barsEnter.merge(bars);

            barMerge.select<SVGRectElement>("rect.main")
                .attr("x", d => x(d.category)!)
                .attr("width", x.bandwidth())
                .attr("y", d => y(d.value))
                .attr("rx", radius)
                .attr("ry", radius)
                .attr("height", d => height - y(d.value))
                .attr("fill", d => isHighContrast ? colorPalette.foreground.value : d.color)
                .attr("fill-opacity", d => d.highlight != null ? 0.4 : 1)
                .attr("stroke", isHighContrast ? colorPalette.foreground.value : null)
                .style("cursor", "pointer");

            barMerge.select<SVGRectElement>("rect.highlight")
                .attr("x", d => x(d.category)!)
                .attr("width", x.bandwidth())
                .attr("y", d => y(d.highlight ?? d.value))
                .attr("rx", radius)
                .attr("ry", radius)
                .attr("height", d => height - y(d.highlight ?? d.value))
                .attr("fill", d => isHighContrast ? colorPalette.foreground.value : d.color)
                .style("pointer-events", "none");

            barMerge
                .on("click", (event, d) => {
                    const isCtrl = (<MouseEvent>event).ctrlKey;
                    this.selectionManager.select(d.selectionId, isCtrl);
                })
                .on("contextmenu", (event, d) => {
                    event.preventDefault();
                    this.selectionManager.showContextMenu(d.selectionId, { x: (<MouseEvent>event).clientX, y: (<MouseEvent>event).clientY });
                })
                .on("keydown", (event, d) => {
                    if ((<KeyboardEvent>event).key === "Enter") {
                        this.selectionManager.select(d.selectionId, false);
                    }
                })
                .each((d, i, nodes) => {
                    const node = select(nodes[i]);
                    this.tooltipServiceWrapper.addTooltip(node, () => d.tooltipInfo);
                });

            bars.exit().remove();
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return formattingSettingsService.buildFormattingModel(this.settings);
    }
}
