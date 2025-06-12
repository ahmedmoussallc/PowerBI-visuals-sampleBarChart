import powerbiVisualsApi from "powerbi-visuals-api";
import { formattingSettings, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

const { SimpleCard, NumUpDown, ToggleSwitch, ColorPicker, Model } = formattingSettings;
import ValidatorType = powerbiVisualsApi.visuals.ValidatorType;

export class VisualSettings extends Model {
    public barCard = new class extends SimpleCard {
        cornerRadius = new NumUpDown({
            name: "cornerRadius",
            displayName: "Corner radius",
            value: 0,
            options: { 
                minValue: { type: ValidatorType.Min, value: 0 },
                maxValue: { type: ValidatorType.Max, value: 50 }
            }
        });

        horizontal = new ToggleSwitch({
            name: "horizontal",
            displayName: "Horizontal vs Vertical",
            value: false
        });

        name = "barCard";
        displayName = "Bar";
        slices = [this.cornerRadius, this.horizontal];
    }();

    public dataColors = new class extends SimpleCard {
        defaultColor = new ColorPicker({
            name: "defaultColor",
            displayName: "Default color",
            value: { value: "" }
        });

        name = "dataColors";
        displayName = "Data colors";
        slices = [this.defaultColor];
    }();

    cards = [this.barCard, this.dataColors];
}

export const formattingSettingsService = new FormattingSettingsService();
