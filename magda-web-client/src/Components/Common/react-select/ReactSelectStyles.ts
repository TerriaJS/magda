/**
 * React Select builds css using [emotion](https://emotion.sh/docs/introduction)
 * We are required to customise styles via a styles object:
 * https://react-select.com/styles
 */
const customStyles = {
    control: (provided, state) => {
        if (state.selectProps.isValidationError) {
            return {
                ...provided,
                minHeight: "44px",
                backgroundColor: "#fdf2f2",
                borderColor: "#d60000",
                boxShadow: "none",
                "&:hover": {
                    backgroundColor: "#fdf2f2",
                    borderColor: "#d60000",
                    boxShadow: "none"
                }
            };
        } else {
            return {
                ...provided,
                minHeight: "44px"
            };
        }
    },
    multiValue: provided => ({
        ...provided,
        backgroundColor: "#30384d",
        color: "#ffffff",
        height: "34px",
        borderRadius: "17px",
        fontSize: "14px",
        fontWeight: "500",
        fontStyle: "normal",
        fontStretch: "normal",
        lineHeight: "normal",
        letterSpacing: "normal",
        minWidth: "111px",
        paddingTop: "8px",
        paddingBottom: "10px",
        paddingLeft: "19px",
        paddingRight: "20px"
    }),
    multiValueLabel: provided => ({
        ...provided,
        color: "#ffffff",
        height: "34px",
        fontSize: "14px",
        fontWeight: "500",
        fontStyle: "normal",
        fontStretch: "normal",
        lineHeight: "normal",
        letterSpacing: "normal",
        minWidth: "50px",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        overflow: "hidden",
        padding: "0px"
    }),
    multiValueRemove: () => ({
        padding: "0px",
        marginLeft: "16px",
        marginTop: "0px",
        border: "none",
        cursor: "pointer",
        "&:hover": {
            backgroundColor: "transparent",
            color: "#ffffff"
        }
    })
};

export const customStylesWithWidth = (width: string) =>
    width
        ? {
              ...customStyles,
              container: provided => ({
                  ...provided,
                  width
              })
          }
        : customStyles;

export default customStyles;
